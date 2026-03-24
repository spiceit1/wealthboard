import { NextResponse } from "next/server";

import { getAccountsOverview, getDemoUserId } from "@/services/dashboardData";

export async function GET() {
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json({ rows: [] }, { status: 200 });
  }

  const rows = await getAccountsOverview(userId);
  return NextResponse.json({ rows }, { status: 200 });
}

