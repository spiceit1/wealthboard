import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";

import { getHoldingsOverview } from "@/services/dashboardData";

export async function GET() {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const data = await getHoldingsOverview(userId);
  return NextResponse.json(data, { status: 200 });
}

