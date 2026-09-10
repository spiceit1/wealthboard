import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";

import { getSnapshotDetail } from "@/services/dashboardData";

type Params = {
  params: Promise<{ date: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { date } = await params;
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const detail = await getSnapshotDetail(userId, date);
  return NextResponse.json({ detail }, { status: 200 });
}

