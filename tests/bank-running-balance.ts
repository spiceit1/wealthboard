import assert from 'node:assert/strict';
import { bankRunningBalances } from '../lib/bank-running-balance';
import type { CardCharge } from '../lib/credit-card';
const row = (id: string, date: string, amount: number, pending = false, currency = 'USD'): CardCharge =>
  ({id,date,amount,pending,currency,merchant:'Coinbase',category:'Transfer In',excluded:true});
const transactions = [
  row('old','2026-10-31',-100),
  row('deposit','2026-11-02',-9229.98),
  row('spend','2026-11-03',100),
  row('pending','2026-11-04',-4903.81,true),
  row('other','2026-11-04',-999,false,'EUR'),
];
const balances = bankRunningBalances(transactions, 57508.80, 'USD');
assert.equal(balances.get('spend'),57508.80);
assert.equal(balances.get('deposit'),57608.80);
assert.equal(balances.get('old'),48378.82);
assert.equal(balances.has('pending'),false);
assert.equal(balances.has('other'),false);
assert.equal(bankRunningBalances(transactions,null,'USD').size,0);
assert.equal(bankRunningBalances([...transactions].reverse(),57508.80,'USD').get('deposit'),57608.80);
console.log('Running balances: deposits, withdrawals, month boundaries, pending, currency, unavailable anchor and stable ordering passed.');
