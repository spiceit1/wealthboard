import { NextResponse } from "next/server";

import { getDemoUserId, getHoldingsOverview } from "@/services/dashboardData";

export async function GET() {
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json(
      { rows: [], stocksChangeSinceOpen: null, cryptoChangeSinceOpen: null, changeSinceLabel: null },
      { status: 200 },
    );
  }

  const data = await getHoldingsOverview(userId);
  return NextResponse.json(data, { status: 200 });
}

