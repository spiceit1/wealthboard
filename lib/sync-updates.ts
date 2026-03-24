import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { syncRuns } from "@/db/schema";

export type LatestSyncRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  trigger: "manual" | "scheduled" | "system";
  startedAt: Date;
  completedAt: Date | null;
} | null;

export async function getLatestSyncRunForUser(userId: string): Promise<LatestSyncRun> {
  const [latest] = await db
    .select({
      id: syncRuns.id,
      status: syncRuns.status,
      trigger: syncRuns.trigger,
      startedAt: syncRuns.startedAt,
      completedAt: syncRuns.completedAt,
    })
    .from(syncRuns)
    .where(eq(syncRuns.userId, userId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  return latest ?? null;
}

