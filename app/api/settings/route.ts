import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getDemoUserId, getSettingsOverview } from "@/services/dashboardData";

export async function GET() {
  const userId = await getDemoUserId();
  const data = userId ? await getSettingsOverview(userId) : null;

  return NextResponse.json(
    {
      data,
      mockMode: env.MOCK_MODE,
      internalTokenSet: Boolean(env.INTERNAL_SYNC_TOKEN),
    },
    { status: 200 },
  );
}

