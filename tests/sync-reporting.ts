import assert from 'node:assert/strict';
import { describeSyncRun } from '../lib/sync-reporting';
import { fetchCryptoPrices } from '../providers/coingecko';

async function main() {
  const failed = { status: 'failed', errorMessage: 'Crypto quotes unavailable for BTC', lastEvent: 'Sync failed' };
  const report = describeSyncRun({ ...failed, events: [{ message: 'Updated prices for 16/16 stock symbols and 0/4 crypto symbols' }] });
  assert.equal(report.label, 'Partially updated');
  assert.equal(report.detail, failed.errorMessage);
  assert.equal(describeSyncRun({ ...failed, events: [{message: 'Updated prices for 0/16 stock symbols and 0/4 crypto symbols'}] }).partial, false);
  assert.equal(describeSyncRun({ ...failed, events: [{message: 'Saved TD Checking balance'}] }).partial, true);
  assert.equal(describeSyncRun(failed).label, 'failed');
  assert.equal(describeSyncRun({ ...failed, status: 'completed', errorMessage: null, lastEvent: 'Sync complete' }).detail, 'Sync complete');
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, text] of [[429, 'rate limit'], [503, 'provider service'], [401, 'API access']] as const) {
      globalThis.fetch = async () => new Response('secret upstream body', {status});
      await assert.rejects(fetchCryptoPrices(['BTC']), (error: Error) => error.message.includes(String(status)) && error.message.includes(text) && !error.message.includes('secret'));
    }
    globalThis.fetch = async () => { throw new Error('secret network details'); };
    await assert.rejects(fetchCryptoPrices(['BTC']), /network request failed before an HTTP response/);
    globalThis.fetch = async () => new Response('not JSON');
    await assert.rejects(fetchCryptoPrices(['BTC']), /invalid price response/);
    globalThis.fetch = async () => Response.json([{symbol:'btc', current_price:42}, null, {symbol:'eth', current_price:-1}]);
    assert.deepEqual((await fetchCryptoPrices(['BTC','ETH'])).data, [{symbol:'BTC',price:42}]);
  } finally { globalThis.fetch = originalFetch; }
  console.log('Sync reporting and CoinGecko error tests passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
