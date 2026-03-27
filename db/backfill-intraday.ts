/**
 * Backfills intraday snapshots from historical scheduled daily snapshots.
 *
 * This is best-effort historical reconstruction: each scheduled daily snapshot
 * becomes one intraday point at the run completion timestamp.
 *
 * Run: npm run db:backfill-intraday
 */
import { config } from "dotenv";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

const localEnv = config({ path: ".env.local" });
if (localEnv.parsed) {
  Object.assign(process.env, localEnv.parsed);
}
config();

import { db } from "@/db/client";
import { dailySnapshots, intradaySnapshots, syncRuns, users } from "@/db/schema";

async function backfillForUser(userId: string, email: string) {
  const existing = await db
    .select({ syncRunId: intradaySnapshots.syncRunId })
    .from(intradaySnapshots)
    .where(and(eq(intradaySnapshots.userId, userId), isNotNull(intradaySnapshots.syncRunId)));
  const alreadyBackfilled = new Set(existing.map((row) => row.syncRunId).filter(Boolean));

  const rows = await db
    .select({
      syncRunId: dailySnapshots.syncRunId,
      cashTotal: dailySnapshots.cashTotal,
      stocksTotal: dailySnapshots.stocksTotal,
      cryptoTotal: dailySnapshots.cryptoTotal,
      totalNetWorth: dailySnapshots.totalNetWorth,
      capturedAt: syncRuns.completedAt,
    })
    .from(dailySnapshots)
    .innerJoin(syncRuns, eq(dailySnapshots.syncRunId, syncRuns.id))
    .where(
      and(
        eq(dailySnapshots.userId, userId),
        inArray(syncRuns.trigger, ["scheduled"]),
        eq(syncRuns.status, "completed"),
      ),
    );

  let inserted = 0;
  for (const row of rows) {
    if (!row.syncRunId || alreadyBackfilled.has(row.syncRunId)) continue;
    await db.insert(intradaySnapshots).values({
      userId,
      syncRunId: row.syncRunId,
      cashTotal: row.cashTotal,
      stocksTotal: row.stocksTotal,
      cryptoTotal: row.cryptoTotal,
      totalNetWorth: row.totalNetWorth,
      capturedAt: row.capturedAt ?? new Date(),
    });
    inserted += 1;
  }

  console.log(`User ${email}: inserted ${inserted} intraday point(s).`);
}

async function main() {
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  if (!allUsers.length) {
    console.log("No users found.");
    return;
  }

  for (const user of allUsers) {
    await backfillForUser(user.id, user.email);
  }
  console.log("Backfill complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
