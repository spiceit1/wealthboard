// Explicitly run against an isolated Neon branch; never production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, connections, plaidItems, holdings } from '../db/schema';
import { persistInvestmentSnapshot } from '../services/investmentHoldings';
import { getHoldingsOverview } from '../services/dashboardData';
import { runPriceOnlySync } from '../services/runFullSync';
import { upsertManualHolding } from '../services/manualHoldings';

async function main() {
  if (process.env.INVESTMENTS_TEST_BRANCH !== 'br-divine-glitter-ah0d1miy') throw new Error('Isolated test branch confirmation required');
  if (!new URL(process.env.DATABASE_URL ?? '').hostname.startsWith('ep-ancient-water-ah59vxq8')) throw new Error('Wrong database endpoint');
  const userId=randomUUID(), itemId='test-'+randomUUID();
  await db.insert(users).values({id:userId,email:`${userId}@test.invalid`,fullName:'Investment test'});
  await db.insert(connections).values({userId,provider:'plaid',externalId:itemId,displayName:'Test Brokerage'});
  await db.insert(plaidItems).values({userId,itemId,accessTokenEncrypted:'not-a-token',investmentsEnabled:true,replaceManualStocks:true});
  await upsertManualHolding({userId,symbol:'AAPL',quantity:10,assetClass:'stock'});
  await upsertManualHolding({userId,symbol:'OLD',quantity:5,assetClass:'stock'});
  await upsertManualHolding({userId,symbol:'BTC',quantity:1,assetClass:'crypto'});
  const snapshot={accounts:[{accountId:'account-'+userId,name:'Test Brokerage'}],positions:[{accountId:'account-'+userId,securityId:'aapl',symbol:'AAPL',name:'Apple',assetClass:'stock' as const,quantity:12.345678,price:100,value:1234.5678,pricedAt:null}]};
  await persistInvestmentSnapshot(userId,itemId,snapshot);
  await persistInvestmentSnapshot(userId,itemId,snapshot);
  let active=(await getHoldingsOverview(userId)).rows;
  assert.equal(active.filter(h=>h.assetClass==='stock').length,1);
  assert.equal(active.find(h=>h.symbol==='AAPL')?.quantity,12.345678);
  assert.equal(active.find(h=>h.symbol==='AAPL')?.isManual,false);
  assert.equal(active.find(h=>h.symbol==='BTC')?.quantity,1);
  const backups=await db.query.holdings.findMany({where:and(eq(holdings.userId,userId),eq(holdings.isManual,true),eq(holdings.includedInTotals,false))});
  assert.equal(backups.length,2);
  await runPriceOnlySync(userId, 'manual');
  assert.equal((await getHoldingsOverview(userId)).rows.find(h=>h.symbol==='AAPL')?.quantity,12.345678);
  // Subsequent imports preserve newly entered positions at other brokerages.
  await upsertManualHolding({userId,symbol:'MSFT',quantity:2,assetClass:'stock'});
  snapshot.positions[0].quantity=3; snapshot.positions[0].value=300;
  await persistInvestmentSnapshot(userId,itemId,snapshot);
  active=(await getHoldingsOverview(userId)).rows;
  assert.equal(active.find(h=>h.symbol==='AAPL')?.quantity,3);
  assert.equal(active.find(h=>h.symbol==='MSFT')?.quantity,2);
  // A rejected database write rolls back exclusion of existing holdings.
  const invalid={...snapshot,positions:[{...snapshot.positions[0],securityId:'bad',symbol:'X'.repeat(100)}]};
  await assert.rejects(persistInvestmentSnapshot(userId,itemId,invalid));
  assert.equal((await getHoldingsOverview(userId)).rows.find(h=>h.symbol==='AAPL')?.quantity,3);
  await persistInvestmentSnapshot(userId,itemId,{...snapshot,positions:[]});
  assert.equal((await getHoldingsOverview(userId)).rows.some(h=>h.symbol==='AAPL'),false);
  console.log('Isolated investment import passed: idempotence, manual backup, no double counting, quantity changes, rollback, sold positions. Test user:',userId);
}
void main();
