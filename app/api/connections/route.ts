import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getProviderAdapterModes } from "@/providers/adapters";
import { getConnectionsOverview, getDemoUserId } from "@/services/dashboardData";

export async function GET() {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host && !host.includes("localhost") ? `${proto}://${host}` : null;
  const oauthRedirectExample = requestOrigin
    ? `${requestOrigin}/connections`
    : `${env.APP_URL.replace(/\/$/, "")}/connections`;

  const userId = await getDemoUserId();
  const rows = userId ? await getConnectionsOverview(userId) : [];
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

