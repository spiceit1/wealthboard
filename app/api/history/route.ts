import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";

import { getHistoryRows } from "@/services/dashboardData";

export async function GET() {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const rows = await getHistoryRows(userId);
  return NextResponse.json({ rows }, { status: 200 });
}

