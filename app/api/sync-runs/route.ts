import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";

import { getSyncRuns } from "@/services/dashboardData";

export async function GET(request: Request) {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 25), 1), 100);
  const offset = (page - 1) * pageSize;

  const result = await getSyncRuns(userId, { limit: pageSize, offset });
  return NextResponse.json(
    {
      runs: result.runs,
      total: result.total,
      page,
      pageSize,
    },
    { status: 200 },
  );
}

