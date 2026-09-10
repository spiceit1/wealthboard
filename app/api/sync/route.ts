import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";


import { getSyncRunProgress, triggerSyncInBackground } from "@/services/runFullSync";

export async function GET(request: Request) {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
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
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
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
