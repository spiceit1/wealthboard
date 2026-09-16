import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, plaidItems, accounts } from '../db/schema';
import { savePlaidAccessToken, getPlaidAccessTokensForUser } from '../services/plaidTokens';
async function main() {
 if (!new URL(process.env.DATABASE_URL ?? '').hostname.startsWith('ep-sweet-shadow-ahkyiy46')) throw new Error('Isolated credit test branch required');
 const userId = randomUUID();
 await db.insert(users).values({id:userId,email:`${userId}@test.invalid`,fullName:'Credit test'});
 const common = {userId,accessToken:'synthetic-token',institutionName:'Test Robinhood',institutionId:'test-institution'};
 const broker = await savePlaidAccessToken({...common,itemId:`stocks-${userId}`,investmentsEnabled:true});
 await db.insert(accounts).values({userId,connectionId:broker.id,providerAccountId:`broker-${userId}`,institutionName:'Test Robinhood',name:'Brokerage',type:'brokerage',lastBalance:'100'});
 await savePlaidAccessToken({...common,itemId:`credit-${userId}`,creditEnabled:true});
 await savePlaidAccessToken({...common,itemId:`credit-${userId}`,creditEnabled:true});
 assert.equal((await db.query.plaidItems.findMany({where:eq(plaidItems.userId,userId)})).length,2);
 const tokens=await getPlaidAccessTokensForUser(userId);
 assert.equal(tokens.filter(t=>t.creditEnabled).length,1);
 assert.equal(tokens.filter(t=>t.investmentsEnabled).length,1);
 assert.equal(tokens.filter(t=>!t.creditEnabled&&!t.investmentsEnabled).length,0);
 assert.equal((await db.query.accounts.findMany({where:eq(accounts.userId,userId)})).length,1);
 console.log('Card token persistence is idempotent, preserves brokerage, and excludes card from bank imports.');
}
void main();
