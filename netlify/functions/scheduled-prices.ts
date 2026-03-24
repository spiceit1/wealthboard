import { getDemoUserId } from "../../services/dashboardData";
import { triggerPriceOnlySyncInBackground } from "../../services/runFullSync";

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
  // 09:30 through 16:00 America/New_York
  if (hour < 9 || hour > 16) return false;
  if (hour === 9 && minute < 30) return false;
  if (hour === 16 && minute > 0) return false;
  return true;
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
        reason: "Outside weekday market window (09:30-16:00 America/New_York).",
        nyWeekday: weekday,
        nyHour: hour,
        nyMinute: minute,
      });
    }

    const userId = await getDemoUserId();
    if (!userId) {
      return json({ message: "Demo user not found." }, 404);
    }

    // Use trigger=system so this can run many times/day without daily-scheduled dedupe.
    const run = await triggerPriceOnlySyncInBackground(userId, "system");
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

