import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, connections, holdings, plaidItems } from '@/db/schema';
import { getPlaidClient } from '@/lib/plaid';
import { normalizeInvestmentHoldings, type InvestmentSnapshot } from '@/lib/investment-holdings';
import { getPlaidAccessTokensForUser } from './plaidTokens';

// All mutations are one transaction. A failed/partial provider response never clears positions.
export async function persistInvestmentSnapshot(userId: string, itemId: string, snapshot: InvestmentSnapshot) {
  const conn = await db.query.connections.findFirst({ where: and(eq(connections.userId,userId),eq(connections.provider,'plaid'),eq(connections.externalId,itemId)) });
  if (!conn) throw new Error('Investment connection not found.');
  const accountJson = JSON.stringify(snapshot.accounts.map(account => ({...account,
    name: conn.displayName.toLowerCase().includes('robinhood') && account.mask === '8533' ? 'Agentic ••••8533' : account.mask ? `${account.name} ••••${account.mask}`.slice(0,120) : account.name
  })));
  const positionJson = JSON.stringify(snapshot.positions);
  await db.batch([
    db.execute(sql`INSERT INTO accounts (user_id,connection_id,provider_account_id,institution_name,name,type,currency)
      SELECT ${userId}::uuid,${conn.id}::uuid,x->>'accountId',${conn.displayName},x->>'name','brokerage','USD'
      FROM jsonb_array_elements(${accountJson}::jsonb) x
      ON CONFLICT (user_id,provider_account_id) DO UPDATE SET connection_id=EXCLUDED.connection_id,name=EXCLUDED.name,institution_name=EXCLUDED.institution_name,included_in_totals=true,updated_at=now()`),
    db.execute(sql`UPDATE holdings h SET included_in_totals=false WHERE h.user_id=${userId} AND h.is_manual=false
      AND h.account_id IN (SELECT id FROM accounts WHERE connection_id=${conn.id})
      AND (h.asset_class != 'cash' OR EXISTS (SELECT 1 FROM jsonb_array_elements(${positionJson}::jsonb) cp JOIN accounts ca ON ca.provider_account_id=cp->>'accountId' AND ca.user_id=${userId} WHERE ca.id=h.account_id AND cp->>'assetClass'='cash'))
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${positionJson}::jsonb) p JOIN accounts a ON a.provider_account_id=p->>'accountId' AND a.user_id=${userId}
        WHERE a.id=h.account_id AND p->>'securityId'=h.plaid_security_id)`),
    db.execute(sql`INSERT INTO holdings (user_id,account_id,symbol,name,asset_class,quantity,last_price,market_value,is_manual,included_in_totals,plaid_security_id,quantity_synced_at,updated_at)
      SELECT ${userId}::uuid,a.id,p->>'symbol',p->>'name',(p->>'assetClass')::asset_class,(p->>'quantity')::numeric,(p->>'price')::numeric,(p->>'value')::numeric,false,true,p->>'securityId',now(),coalesce((p->>'pricedAt')::timestamptz,now())
      FROM jsonb_array_elements(${positionJson}::jsonb) p JOIN accounts a ON a.user_id=${userId} AND a.provider_account_id=p->>'accountId'
      ON CONFLICT (user_id,account_id,plaid_security_id) DO UPDATE SET is_manual=false,symbol=EXCLUDED.symbol,name=EXCLUDED.name,quantity=EXCLUDED.quantity,last_price=EXCLUDED.last_price,market_value=EXCLUDED.market_value,included_in_totals=true,quantity_synced_at=now(),updated_at=EXCLUDED.updated_at`),
    // Retire the manually verified Agentic cash only after Plaid supplies cash for that same masked account.
    db.execute(sql`UPDATE holdings SET included_in_totals=false WHERE user_id=${userId} AND asset_class='cash'
      AND account_id IN (SELECT id FROM accounts WHERE user_id=${userId} AND provider_account_id='manual:robinhood:8533')
      AND lower(${conn.displayName}) LIKE '%robinhood%'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(${accountJson}::jsonb) a JOIN jsonb_array_elements(${positionJson}::jsonb) p ON a->>'accountId'=p->>'accountId' WHERE a->>'mask'='8533' AND p->>'assetClass'='cash')`),
    // Only the explicitly selected replacement option retires manual stock entries.
    db.execute(sql`UPDATE holdings SET included_in_totals=false WHERE user_id=${userId} AND is_manual=true AND asset_class='stock'
      AND EXISTS (SELECT 1 FROM plaid_items WHERE user_id=${userId} AND item_id=${itemId} AND replace_manual_stocks=true)`),
    db.execute(sql`UPDATE plaid_items SET replace_manual_stocks=false,holdings_synced_at=now(),updated_at=now() WHERE user_id=${userId} AND item_id=${itemId}`),
    db.execute(sql`UPDATE connections SET last_synced_at=now(),status='active',updated_at=now() WHERE id=${conn.id}`),
  ]);
  return snapshot.positions.length;
}

export async function syncInvestmentHoldings(userId: string) {
  const tokens = (await getPlaidAccessTokensForUser(userId)).filter(item => item.investmentsEnabled);
  const results: string[] = [];
  const failures: string[] = [];
  for (const item of tokens) {
    try {
      const response = await getPlaidClient().investmentsHoldingsGet({ access_token: item.accessToken }, { timeout: 90_000 });
      const snapshot = normalizeInvestmentHoldings(response.data);
      const count = await persistInvestmentSnapshot(userId, item.itemId, snapshot);
      results.push(`Imported ${count} investment positions with quantities from Plaid`);
    } catch (error) {
      const provider = error as {response?: {data?: {error_code?: string; error_message?: string}}};
      const code = provider.response?.data?.error_code;
      failures.push(code ? `Investment sync: ${code}. ${code === 'ITEM_LOGIN_REQUIRED' ? 'Reconnect the investment account.' : 'Previous holdings retained; retry the sync later.'}` : error instanceof Error ? error.message : 'Investment sync failed');
    }
  }
  // The owner shared Agentic on a separate Robinhood Plaid Item. Read its cash
  // without importing duplicate Individual positions from that second connection.
  const tracked = await db.query.accounts.findFirst({where:and(eq(accounts.userId,userId),eq(accounts.providerAccountId,'manual:robinhood:8533'))});
  if (tracked) {
    const trackedCash = await db.query.holdings.findFirst({where:and(eq(holdings.accountId,tracked.id),eq(holdings.userId,userId),eq(holdings.assetClass,'cash'),eq(holdings.includedInTotals,true))});
    if (trackedCash) {
      for (const item of (await getPlaidAccessTokensForUser(userId)).filter(t=>t.creditEnabled && !t.investmentsEnabled)) {
        const connection = await db.query.connections.findFirst({where:and(eq(connections.userId,userId),eq(connections.externalId,item.itemId),eq(connections.provider,'plaid'))});
        if (!connection?.displayName.toLowerCase().includes('robinhood')) continue;
        try {
          const response = await getPlaidClient().accountsGet({access_token:item.accessToken},{timeout:30_000});
          const matches = response.data.accounts.filter(a=>a.type==='investment' && a.mask==='8533');
          if (matches.length !== 1) continue;
          const cash = matches[0].balances.available;
          if (cash == null || !Number.isFinite(cash) || cash < 0 || matches[0].balances.iso_currency_code!=='USD') {
            failures.push('Agentic cash unavailable from Plaid; previous balance retained.'); continue;
          }
          await db.update(holdings).set({quantity:cash.toFixed(8),lastPrice:'1',marketValue:cash.toFixed(2),isManual:false,name:'Agentic cash from Plaid',quantitySyncedAt:new Date(),updatedAt:new Date()})
            .where(and(eq(holdings.id,trackedCash.id),eq(holdings.includedInTotals,true)));
          results.push('Agentic cash updated from authorized Robinhood Plaid connection');
          break;
        } catch { failures.push('Agentic cash sync failed; previous balance retained.'); }
      }
    }
  }
  return { results, failures };
}
