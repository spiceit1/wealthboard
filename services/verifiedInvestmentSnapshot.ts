import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { VERIFIED_PREFIX } from '@/lib/verified-investments';

// Trusted operator import only: complete broker positions + cash, never an order preview.
// No public endpoint. Caller must verify account identity and all pages of positions.
export async function saveVerifiedInvestmentSnapshot(input: {
  userId:string; accountId:string; verifiedAt:string; cash:number;
  positions:Array<{symbol:string;quantity:number;price:number}>;
}) {
  const at = new Date(input.verifiedAt);
  if (!Number.isFinite(at.getTime()) || Math.abs(Date.now()-at.getTime())>300_000) throw new Error('Verification must be within five minutes.');
  if (!Number.isFinite(input.cash) || input.cash<0) throw new Error('Invalid verified cash.');
  const account=await db.query.accounts.findFirst({where:and(eq(accounts.id,input.accountId),eq(accounts.userId,input.userId))});
  if (!account?.connectionId || !account.institutionName.toLowerCase().includes('robinhood')) throw new Error('Expected an existing linked Robinhood account.');
  const symbols=new Set<string>();
  for(const p of input.positions) {
    if (!/^[A-Z0-9.\-]{1,20}$/.test(p.symbol) || symbols.has(p.symbol) || !Number.isFinite(p.quantity) || p.quantity<=0 || !Number.isFinite(p.price) || p.price<=0) throw new Error('Invalid or duplicate verified position.');
    symbols.add(p.symbol);
  }
  const rows=[...input.positions.map(p=>({...p,assetClass:'stock',value:p.quantity*p.price})),
    {symbol:'USD',quantity:input.cash,price:1,value:input.cash,assetClass:'cash'}];
  await db.batch([
    db.execute(sql`UPDATE holdings SET included_in_totals=false WHERE user_id=${input.userId} AND account_id=${input.accountId}`),
    db.execute(sql`INSERT INTO holdings (user_id,account_id,symbol,name,asset_class,quantity,last_price,market_value,is_manual,included_in_totals,plaid_security_id,quantity_synced_at,updated_at)
      SELECT ${input.userId}::uuid,${input.accountId}::uuid,p->>'symbol',p->>'symbol',(p->>'assetClass')::asset_class,(p->>'quantity')::numeric,(p->>'price')::numeric,(p->>'value')::numeric,false,true,${VERIFIED_PREFIX} || (p->>'symbol'),${at}::timestamptz,${at}::timestamptz
      FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) p
      ON CONFLICT (user_id,account_id,plaid_security_id) DO UPDATE SET quantity=EXCLUDED.quantity,last_price=EXCLUDED.last_price,market_value=EXCLUDED.market_value,is_manual=false,included_in_totals=true,quantity_synced_at=EXCLUDED.quantity_synced_at,updated_at=EXCLUDED.updated_at`)
  ]);
}
