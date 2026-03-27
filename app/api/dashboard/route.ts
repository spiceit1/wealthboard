import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getDashboardData, getDemoUserId } from "@/services/dashboardData";

export async function GET() {
  const userId = await getDemoUserId();

  if (!userId) {
    return NextResponse.json(
      {
        summary: null,
        history: [],
        intradayHistory: [],
        latestIntradaySyncAt: null,
        latestSync: null,
        events: [],
        mockMode: env.MOCK_MODE,
      },
      { status: 200 },
    );
  }

  const data = await getDashboardData(userId);
  return NextResponse.json({
    ...data,
    mockMode: env.MOCK_MODE,
  });
}
