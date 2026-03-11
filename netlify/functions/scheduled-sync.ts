import type { Handler } from "@netlify/functions";

import { runFullSync } from "../../services/runFullSync";

/**
 * Phase 1 scaffold.
 * The actual cron schedule and duplicate-run protection are finalized in Phase 6.
 */
export const config = {
  // 14:00 UTC ~= 9:00 AM America/New_York during EST.
  // This is a placeholder and will be hardened in Phase 6.
  schedule: "0 14 * * *",
};

export const handler: Handler = async () => {
  try {
    const result = await runFullSync();
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
