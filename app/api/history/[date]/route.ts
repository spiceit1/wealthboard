import { NextResponse } from "next/server";

import { getDemoUserId, getSnapshotDetail } from "@/services/dashboardData";

type Params = {
  params: Promise<{ date: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { date } = await params;
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json({ detail: null }, { status: 200 });
  }

  const detail = await getSnapshotDetail(userId, date);
  return NextResponse.json({ detail }, { status: 200 });
}

