import type { Handler } from "@netlify/functions";

import { env } from "../../lib/env";
import { getDemoUserId } from "../../services/dashboardData";
import { runFullSync } from "../../services/runFullSync";

export const handler: Handler = async (event) => {
  try {
    if (!env.INTERNAL_SYNC_TOKEN && env.NODE_ENV === "production") {
      return {
        statusCode: 503,
        body: JSON.stringify({ message: "INTERNAL_SYNC_TOKEN must be configured in production." }),
      };
    }

    if (env.INTERNAL_SYNC_TOKEN) {
      const provided = event.headers["x-internal-sync-token"] ?? event.headers["X-Internal-Sync-Token"];
      if (provided !== env.INTERNAL_SYNC_TOKEN) {
        return {
          statusCode: 401,
          body: JSON.stringify({ message: "Unauthorized" }),
        };
      }
    }

    const userId = await getDemoUserId();
    if (!userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Demo user not found." }),
      };
    }

    const result = await runFullSync(userId, "manual");
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Manual sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
