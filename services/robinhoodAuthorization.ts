import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { robinhoodOauthAttempts } from "@/db/schema";
import { oauthHash } from "@/lib/robinhood-oauth";
export async function claimRobinhoodAuthorization(userId: string, state: string, browser: string) {
  const [attempt] = await db.delete(robinhoodOauthAttempts).where(and(
    eq(robinhoodOauthAttempts.userId, userId), eq(robinhoodOauthAttempts.stateHash, oauthHash(state)),
    eq(robinhoodOauthAttempts.browserHash, oauthHash(browser)), gt(robinhoodOauthAttempts.expiresAt, new Date()),
  )).returning();
  return attempt ?? null;
}
