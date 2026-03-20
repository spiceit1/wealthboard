import { NextResponse } from "next/server";

import { getDemoUserId } from "@/services/dashboardData";
import { getSyncRunProgress, triggerPriceOnlySyncInBackground } from "@/services/runFullSync";

export async function POST() {
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
  }

  const run = await triggerPriceOnlySyncInBackground(userId, "manual");
  return NextResponse.json(run, { status: 200 });
}

export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ message: "runId is required." }, { status: 400 });
  }

  const progress = await getSyncRunProgress(runId);
  return NextResponse.json(progress, { status: 200 });
}
