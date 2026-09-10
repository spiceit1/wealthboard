import assert from 'node:assert/strict';
import { fetchStockPrices, fetchStockQuote, parseStockQuote } from '../services/stockQuotes';
const payload = (price = 100, time = Date.now() / 1000, currency = 'USD') => ({chart:{result:[{meta:{regularMarketPrice:price,regularMarketTime:time,currency}}]}});
async function main() {
  assert.equal(parseStockQuote(payload()).price, 100);
  for (const value of [payload(-1), payload(100, 1), payload(100, Date.now()/1000, 'EUR'), {}, payload(NaN)]) {
    assert.throws(() => parseStockQuote(value));
  }
  let calls = 0;
  const request = (async () => ++calls === 1 ? new Response('unavailable', {status:429}) : Response.json(payload())) as typeof fetch;
  assert.equal((await fetchStockQuote('AAPL', request)).price, 100);
  assert.equal(calls, 2);
  const mixed = (async (url: string | URL | Request) => String(url).includes('/BAD?') ? new Response('missing', {status:404}) : Response.json(payload())) as typeof fetch;
  const result = await fetchStockPrices(['GOOD', 'BAD'], mixed);
  assert.equal(result.quotes.size, 1);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /BAD.*404/);
  console.log('Stock quote validation, fallback, and partial failure tests passed.');
}
main();
