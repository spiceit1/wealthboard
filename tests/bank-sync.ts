import assert from 'node:assert/strict';
import { bankSyncAuthorization, validBankSyncAuthorization, dispatchBankSync, hasFreshCashAsOfNyDay } from '../lib/bank-sync';

async function main() {
  const secret = 'test-internal-key';
  const now = Date.now();
  const authorization = bankSyncAuthorization(secret, now);
  assert.equal(validBankSyncAuthorization(authorization, secret, now), true);
  for (const value of [null, '', 'invalid', authorization + '0']) {
    assert.equal(validBankSyncAuthorization(value, secret, now), false);
  }
  assert.equal(validBankSyncAuthorization(authorization, 'wrong-key', now), false);
  assert.equal(validBankSyncAuthorization(authorization, '', now), false);
  assert.equal(validBankSyncAuthorization(authorization, secret, now + 300_001), false);
  assert.equal(validBankSyncAuthorization(authorization, secret, now - 300_001), false);
  assert.throws(() => bankSyncAuthorization(''));

  const today = new Date('2026-09-14T13:00:00Z');
  const yesterday = new Date('2026-09-13T13:00:00Z');
  assert.equal(hasFreshCashAsOfNyDay([today, today], '2026-09-14'), true);
  for (const values of [[today, yesterday], [today, null], [], [new Date('invalid')]]) {
    assert.equal(hasFreshCashAsOfNyDay(values, '2026-09-14'), false);
  }
  assert.equal(hasFreshCashAsOfNyDay([new Date('2026-09-14T02:00:00Z')], '2026-09-13'), true);

  const config = { URL: 'https://wealth.example', INTERNAL_SYNC_TOKEN: secret };
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(String(input), 'https://wealth.example/.netlify/functions/bank-sync-background');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.equal(validBankSyncAuthorization(new Headers(init?.headers).get('x-bank-sync-authorization'), secret), true);
    return new Response(null, { status: 202 });
  };
  assert.equal((await dispatchBankSync(config, fetcher)).queued, true);
  await assert.rejects(dispatchBankSync(config, async () => new Response(null, { status: 500 })), /could not be queued/);
  await assert.rejects(dispatchBankSync({ URL: 'http://wealth.example', INTERNAL_SYNC_TOKEN: secret }, fetcher), /HTTPS/);
  await assert.rejects(dispatchBankSync({ URL: config.URL }, fetcher), /authentication/);
  console.log('Bank sync authentication, dispatch and freshness checks passed');
}
void main();
