import { validBankSyncAuthorization } from '../../lib/bank-sync';
import { getDemoUserId } from '../../services/dashboardData';
import { runFullSync, runCreatedFullSync } from '../../services/runFullSync';

export default async (request: Request) => {
  if (request.method !== 'POST' || !validBankSyncAuthorization(
    request.headers.get('x-bank-sync-authorization'), Netlify.env.get('INTERNAL_SYNC_TOKEN') ?? '',
  )) return;
  const userId = await getDemoUserId();
  if (!userId) throw new Error('Owner account not found.');
  const body = await request.json().catch(() => ({})) as { runId?: string };
  const result = body.runId ? await runCreatedFullSync(userId,body.runId) : await runFullSync(userId, 'manual');
  // Netlify retries failed background invocations, including a concurrent sync.
  if (result.status !== 'completed') throw new Error('Investment import did not complete; retry required.');
};
