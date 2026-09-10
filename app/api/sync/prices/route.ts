import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";


import { getSyncRunProgress, triggerPriceOnlySyncInBackground } from "@/services/runFullSync";

export async function POST() {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const run = await triggerPriceOnlySyncInBackground(userId, "manual");
  return NextResponse.json(run, { status: 200 });
}

export async function GET(request: Request) {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ message: "runId is required." }, { status: 400 });
  }

  const progress = await getSyncRunProgress(runId, userId);
  return NextResponse.json(progress, { status: 200 });
}
