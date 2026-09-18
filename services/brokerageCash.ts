import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, holdings } from '@/db/schema';

// Cash is distinct from account market value: positions are counted separately.
export async function getBrokerageCashRows(userId: string) {
  const rows = await db.select({ id:accounts.id,name:accounts.name,currency:accounts.currency,
    institutionName:accounts.institutionName,
    lastBalance:sql<string>`sum(${holdings.marketValue})::text`,
    balanceAsOf:sql<Date>`max(${holdings.updatedAt})`,
    verified:sql<boolean>`bool_or(${holdings.plaidSecurityId} LIKE 'robinhood-verified:%')`,
    manual:sql<boolean>`bool_or(${holdings.isManual})`,
  }).from(accounts).innerJoin(holdings,eq(holdings.accountId,accounts.id))
    .where(and(eq(accounts.userId,userId),eq(holdings.userId,userId),eq(accounts.includedInTotals,true),
      eq(holdings.includedInTotals,true),eq(holdings.assetClass,'cash')))
    .groupBy(accounts.id);
  return rows.map(row => ({...row,balanceAsOf:row.balanceAsOf ? new Date(row.balanceAsOf) : null,
    balanceSource:row.verified ? 'robinhood_verified' : row.manual ? 'manual' : 'plaid'}));
}
