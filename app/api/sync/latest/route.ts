import { NextResponse } from "next/server";

import { getDemoUserId } from "@/services/dashboardData";
import { domainsForRunFinish, domainsForRunStart } from "@/lib/sync-domain-mapping";
import { getLatestSyncRunForUser } from "@/lib/sync-updates";

export async function GET() {
  const userId = await getDemoUserId();
  if (!userId) {
    return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
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

