import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getSettingsOverview } from "@/services/dashboardData";

export async function GET() {
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const data = await getSettingsOverview(userId);

  return NextResponse.json(
    {
      data,
      mockMode: env.MOCK_MODE,
      internalTokenSet: Boolean(env.INTERNAL_SYNC_TOKEN),
    },
    { status: 200 },
  );
}

