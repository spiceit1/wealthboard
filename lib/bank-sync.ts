import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPlaidRedirectUri } from './plaid-redirect';

const purpose = 'wealthboard:scheduled-bank-sync:';
export function bankSyncAuthorization(secret: string, now = Date.now()) {
  if (!secret) throw new Error('Internal sync authentication is not configured.');
  const timestamp = String(now);
  return `${timestamp}.${createHmac('sha256', secret).update(purpose + timestamp).digest('hex')}`;
}

export function validBankSyncAuthorization(value: string | null, secret: string, now = Date.now()) {
  if (!secret || !value || !/^\d+\.[a-f0-9]{64}$/.test(value)) return false;
  const timestamp = Number(value.split('.')[0]);
  if (Math.abs(now - timestamp) > 5 * 60_000) return false;
  const expected = bankSyncAuthorization(secret, timestamp);
  return expected.length === value.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function dispatchBankSync(config: { URL?: string; APP_URL?: string; INTERNAL_SYNC_TOKEN?: string }, fetcher: typeof fetch = fetch, investmentOnly = false, runId?: string) {
  const url = new URL(investmentOnly ? '/.netlify/functions/investments-sync-background' : '/.netlify/functions/bank-sync-background', getPlaidRedirectUri(config));
  const response = await fetcher(url, {
    method: 'POST',
    body: runId ? JSON.stringify({ runId }) : undefined,
    headers: { 'x-bank-sync-authorization': bankSyncAuthorization(config.INTERNAL_SYNC_TOKEN ?? '') },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 202) throw new Error(`Bank sync could not be queued (${response.status}).`);
  return { queued: true, mode: 'bank-sync-background' };
}

export function hasFreshCashAsOfNyDay(values: Array<Date | null>, nyDate: string) {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return values.length > 0 && values.every(value =>
    value instanceof Date && Number.isFinite(value.getTime()) && format.format(value) === nyDate);
}
