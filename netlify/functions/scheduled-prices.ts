import { getDemoUserId } from "../../services/dashboardData";
import { db } from "../../db/client";
import { accounts, dailySnapshots, syncRuns } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { runFullSync, runPriceOnlySync } from "../../services/runFullSync";

export const config = {
  /**
   * Every 15 minutes on weekdays (UTC). Runtime gating ensures we only run during
   * US market hours in America/New_York.
   */
  schedule: "*/15 * * * 1-5",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getNyParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"), // Mon, Tue, ...
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function isMarketWindowNy(hour: number, minute: number) {
  // 09:00 through 16:00 America/New_York
  if (hour < 9 || hour > 16) return false;
  if (hour === 16 && minute > 0) return false;
  return true;
}

function getNyDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function hasFreshCashAsOfNyDay(values: Array<Date | null>, nyDate: string) {
  const latest = values
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!latest) return false;
  return getNyDateKey(latest) === nyDate;
}

export default async (request: Request) => {
  try {
    const force = new URL(request.url).searchParams.get("force") === "1";
    const { weekday, hour, minute } = getNyParts();
    const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
    const inWindow = isMarketWindowNy(hour, minute);

    if (!force && (!isWeekday || !inWindow)) {
      return json({
        skipped: true,
        reason: "Outside weekday market window (09:00-16:00 America/New_York).",
        nyWeekday: weekday,
        nyHour: hour,
        nyMinute: minute,
      });
    }

    const userId = await getDemoUserId();
    if (!userId) {
      return json({ message: "Demo user not found." }, 404);
    }

    const nyDate = getNyDateKey();
    const existingDaily = await db.query.dailySnapshots.findFirst({
      where: and(eq(dailySnapshots.userId, userId), eq(dailySnapshots.snapshotDate, nyDate)),
    });
    const cashRows = await db.query.accounts.findMany({
      where: and(eq(accounts.userId, userId), eq(accounts.type, "checking")),
    });
    const savingsRows = await db.query.accounts.findMany({
      where: and(eq(accounts.userId, userId), eq(accounts.type, "savings")),
    });
    const hasFreshCash = hasFreshCashAsOfNyDay(
      [...cashRows.map((row) => row.balanceAsOf), ...savingsRows.map((row) => row.balanceAsOf)],
      nyDate,
    );

    const latestScheduledRun = await db.query.syncRuns.findFirst({
      where: and(eq(syncRuns.userId, userId), eq(syncRuns.trigger, "scheduled")),
      orderBy: (table, { desc: orderDesc }) => [orderDesc(table.startedAt)],
    });
    const scheduledCooldownMs = 60 * 60 * 1000; // one hour between automated Plaid recovery attempts
    const withinRecoveryCooldown = latestScheduledRun
      ? Date.now() - latestScheduledRun.startedAt.getTime() < scheduledCooldownMs
      : false;

    // Daily recovery rule: if today's 9:00 snapshot is missing, keep retrying full scheduled sync
    // during the intraday schedule window until daily snapshot is written.
    // Also retry if snapshot exists but Plaid cash balances are still stale.
    if ((!existingDaily || !hasFreshCash) && !withinRecoveryCooldown) {
      const run = await runFullSync(userId, "scheduled");
      return json({
        ...run,
        scheduled: true,
        mode: "daily-recovery-full-sync",
        nyDate,
        hasFreshCash,
        nyWeekday: weekday,
        nyHour: hour,
        nyMinute: minute,
      });
    }

    if (!existingDaily || !hasFreshCash) {
      return json({
        skipped: true,
        reason: "Daily recovery sync is cooling down to avoid Plaid rate limits.",
        nyDate,
        hasFreshCash,
        nextRecoveryAttemptInMinutes: Math.ceil(
          Math.max(
            0,
            scheduledCooldownMs -
              (latestScheduledRun ? Date.now() - latestScheduledRun.startedAt.getTime() : 0),
          ) / 60000,
        ),
        nyWeekday: weekday,
        nyHour: hour,
        nyMinute: minute,
      });
    }

    // Run synchronously in scheduled functions; background promises are not reliable in serverless.
    const run = await runPriceOnlySync(userId, "system");
    return json({
      ...run,
      scheduled: true,
      mode: "prices-only",
      nyWeekday: weekday,
      nyHour: hour,
      nyMinute: minute,
    });
  } catch (error) {
    return json(
      {
        message: "Scheduled prices sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

