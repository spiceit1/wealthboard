import type { Handler } from "@netlify/functions";

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

export const handler: Handler = async () => {
  try {
    const nyHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hour12: false,
      }).format(new Date()),
    );
    if (nyHour !== 9) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          skipped: true,
          reason: "Not 09:00 America/New_York yet.",
          nyHour,
        }),
      };
    }

    const userId = await getDemoUserId();
    if (!userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Demo user not found." }),
      };
    }

    const result = await runFullSync(userId, "scheduled");
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Scheduled sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
