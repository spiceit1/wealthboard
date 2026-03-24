import { NextResponse } from "next/server";

import { getDemoUserId, getHistoryRows } from "@/services/dashboardData";

export async function GET() {
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json({ rows: [] }, { status: 200 });
  }

  const rows = await getHistoryRows(userId);
  return NextResponse.json({ rows }, { status: 200 });
}

