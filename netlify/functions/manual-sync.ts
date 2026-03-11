import type { Handler } from "@netlify/functions";

import { runFullSync } from "../../services/runFullSync";

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
        message: "Manual sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
