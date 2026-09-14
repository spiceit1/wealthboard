import { validBankSyncAuthorization } from '../../lib/bank-sync';
import { getDemoUserId } from '../../services/dashboardData';
import { runFullSync } from '../../services/runFullSync';

// Netlify acknowledges immediately; all work below is awaited in its 15-minute worker.
// Unauthorized invocations must exit before reading or changing financial data.
export default async (request: Request) => {
  if (request.method !== 'POST' || !validBankSyncAuthorization(
    request.headers.get('x-bank-sync-authorization'), Netlify.env.get('INTERNAL_SYNC_TOKEN') ?? '',
  )) return;
  const userId = await getDemoUserId();
  if (!userId) throw new Error('Owner account not found.');
  await runFullSync(userId, 'scheduled');
};
