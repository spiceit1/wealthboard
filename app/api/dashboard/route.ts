import { NextResponse } from "next/server";

import { getDashboardData, getDemoUserId } from "@/services/dashboardData";

export async function GET() {
  const userId = await getDemoUserId();

  if (!userId) {
    return NextResponse.json(
      {
        summary: null,
        history: [],
        latestSync: null,
        events: [],
      },
      { status: 200 },
    );
  }

  const data = await getDashboardData(userId);
  return NextResponse.json(data);
}
