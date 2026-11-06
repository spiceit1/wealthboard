import assert from 'node:assert/strict';
import {cents,reconcilePostedGroup,transitAt,transferState,closeTransit,unambiguousCashDrop,type TransferRecord} from '../lib/transfer-reconciliation';
const at=(s:string)=>new Date(`2026-10-28T${s}:00Z`);
const row:TransferRecord={id:'one',amount:'24538',sourceAccountId:'source',destinationAccountId:'dest',sourceLabel:'Robinhood',destinationLabel:'TD',status:'in_transit',destinationBalance:'13921.12',transactionId:null,transferDate:'2026-10-27',intervals:[{from:at('13:00').toISOString(),until:null}],evidence:'Owner confirmed',updatedAt:at('13:00')};
assert.equal(transitAt([row],at('12:59')),0);
assert.equal(transitAt([row],at('13:00')),24538);
const second={...row,id:'two',amount:'500'};
assert.equal(transitAt([row,second],at('14:00')),25038);
assert.equal(-19444.59+transitAt([row,second],at('14:00')),5593.41);
assert.equal(transferState(row,'13921.12',false,at('14:00')).status,'in_transit');
const changed=transferState(row,'38959.12',false,at('14:00'));
assert.equal(changed.status,'needs_review');
assert.equal(transitAt([changed],at('14:00')),0);
assert.equal(transitAt([changed],at('13:30')),24538);
const received=transferState(row,'38959.12',true,at('14:00'));
assert.equal(received.status,'received');assert.equal(transitAt([received],at('14:01')),0);
assert.deepEqual(closeTransit(received.intervals,at('15:00')),received.intervals);
assert.equal(transferState(row,'13921.12',false,new Date('2026-11-05')).status,'needs_review');
assert.equal(unambiguousCashDrop(24538.35,.35,24538,0),true);
assert.equal(unambiguousCashDrop(24538.35,.35,25038,0),false);
assert.equal(unambiguousCashDrop(24538.35,.35,24538,24538),false);
assert.equal(unambiguousCashDrop(100,101,1,0),false);
console.log('Transfer reconciliation: timing, combined deposits, posting, changed balance, expiry, idempotent closure and ambiguous matches passed.');

// The bank credit arrives during the 9am sync, before the snapshot is saved.
// Using the nominal 9am schedule instead of capture time double-counted both deposits.
const settled = [row, second].map(r => ({...r, intervals:[{from:'2026-10-28T13:00:00Z',until:'2026-10-29T13:00:45.853Z'}]}));
assert.equal(transitAt(settled,new Date('2026-10-28T13:00:44.961Z')),25038);
assert.equal(transitAt(settled,new Date('2026-10-29T13:00:50.442Z')),0);
assert.equal(521186.10 + transitAt(settled,new Date('2026-10-29T13:00:50.442Z')),521186.10);
assert.equal(Math.round((510519.63-521186.10)*100)/100,-10666.47);

// Replay the three Coinbase withdrawals with TD receiving one at a time.
let coinbase = ['10207.31', '9229.98', '4903.81'].map((amount, i) => ({
  ...row, id: String(i), amount, sourceLabel: 'Coinbase', destinationBalance: '48278.82',
}));
let bank = 4827882;
const combined = bank + cents(transitAt(coinbase, at('13:00')));
for (const [i, expectedTransit] of [[1, 15111.12], [0, 4903.81], [2, 0]]) {
  const prior = coinbase.find(r => r.id === String(i))!;
  bank += cents(prior.amount);
  const now = at(`1${4 + (i === 1 ? 0 : i === 0 ? 1 : 2)}:00`);
  const next = reconcilePostedGroup(coinbase, (bank / 100).toFixed(2), new Map([[prior.id, 'posted-' + i]]), now);
  assert.ok(next);
  assert.equal(next.filter(r => r.status === 'received').length, 1);
  assert.equal(next.find(r => r.id === prior.id)?.status, 'received');
  assert.equal(transitAt(next, now), expectedTransit);
  assert.equal(bank + cents(transitAt(next, now)), combined);
  coinbase = next.filter(r => r.status === 'in_transit');
}
