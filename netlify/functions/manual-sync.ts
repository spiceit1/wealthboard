import type { Handler } from "@netlify/functions";

import { getDemoUserId } from "../../services/dashboardData";
import { runFullSync } from "../../services/runFullSync";

export const handler: Handler = async () => {
  try {
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
