import { NextResponse } from "next/server";

import { getDemoUserId } from "@/services/dashboardData";
import { getSyncRunProgress, triggerSyncInBackground } from "@/services/runFullSync";

export async function GET(request: Request) {
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ message: "runId is required" }, { status: 400 });
  }

  const result = await getSyncRunProgress(runId, userId);
  return NextResponse.json(result, { status: 200 });
}

export async function POST() {
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
  }

  const run = await triggerSyncInBackground(userId, "manual");
  return NextResponse.json(
    {
      runId: run.runId,
      status: run.status,
      started: run.started,
    },
    { status: 202 },
  );
}
