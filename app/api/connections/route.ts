import { getAuthorizedUserId } from "@/lib/owner-auth";
import { getPlaidRedirectUri } from "@/lib/plaid-redirect";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getProviderAdapterModes } from "@/providers/adapters";
import { getConnectionsOverview } from "@/services/dashboardData";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

export async function GET() {
  const userId = await withTimeout(getAuthorizedUserId(), 4_000, null);
  if (!userId) return NextResponse.json({message:"Sign in required."},{status:401});
  let oauthRedirectExample: string | null = null;
  try { oauthRedirectExample = getPlaidRedirectUri(); } catch { /* Link creation reports the configuration error. */ }
  const rows = userId ? await withTimeout(getConnectionsOverview(userId), 4_000, []) : [];
  const adapterModes = getProviderAdapterModes();
  const plaidKeysPresent = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);

  return NextResponse.json(
    {
      rows,
      adapterModes,
      plaidKeysPresent,
      mockMode: env.MOCK_MODE,
      plaidEnv: env.PLAID_ENV,
      oauthRedirectExample,
    },
    { status: 200 },
  );
}
