import { getDemoUserId } from "../../services/dashboardData";
import { runFullSync } from "../../services/runFullSync";

export const config = {
  /**
   * Netlify schedules in UTC and doesn't support IANA time zones directly.
   * Trigger at both 13:00 and 14:00 UTC; runtime gating ensures execution at
   * exactly 09:00 America/New_York across DST changes.
   */
  schedule: "0 13,14 * * *",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async (request: Request) => {
  try {
    // Local/debug escape hatch. In production, true scheduled functions are not URL-invokable.
    const force = new URL(request.url).searchParams.get("force") === "1";

    const nyHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hour12: false,
      }).format(new Date()),
    );
    if (!force && nyHour !== 9) {
      return json({
        skipped: true,
        reason: "Not 09:00 America/New_York yet.",
        nyHour,
      });
    }

    const userId = await getDemoUserId();
    if (!userId) {
      return json({ message: "Demo user not found." }, 404);
    }

    const result = await runFullSync(userId, "scheduled");
    return json(result);
  } catch (error) {
    return json(
      {
        message: "Scheduled sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
