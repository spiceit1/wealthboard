import { getAuthorizedUserId } from "@/lib/owner-auth";
import { NextResponse } from "next/server";


import { domainsForRunFinish, domainsForRunStart } from "@/lib/sync-domain-mapping";
import { getLatestSyncRunForUser } from "@/lib/sync-updates";

export async function GET() {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const latest = await getLatestSyncRunForUser(userId);
  const affectedDomains =
    latest == null
      ? []
      : latest.status === "running" || latest.status === "pending"
        ? domainsForRunStart()
        : domainsForRunFinish(latest.trigger);

  return NextResponse.json({ latest, affectedDomains }, { status: 200 });
}

