import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { robinhoodConnections, robinhoodOauthAttempts } from "@/db/schema";
import { getAuthorizedUserId } from "@/lib/owner-auth";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { newRobinhoodAuthorization, oauthHash, ROBINHOOD_COOKIE, exchangeRobinhoodCode } from "@/lib/robinhood-oauth";
import { claimRobinhoodAuthorization } from "@/services/robinhoodAuthorization";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const bodySchema = z.discriminatedUnion("action", [z.object({ action: z.literal("connect") }),
  z.object({ action: z.literal("complete"), state: z.string().min(20).max(256), code: z.string().min(1).max(4096) })]);

export async function GET() {
  const userId = await getAuthorizedUserId();
  if (!userId) return json({ message: "Sign in required." }, 401);
  const row = await db.query.robinhoodConnections.findFirst({ where: eq(robinhoodConnections.userId, userId), columns: { updatedAt: true, expiresAt: true } });
  return json({ connected: !!row, directConnectionAvailable: true, connectedAt: row?.updatedAt, liveTradingEnabled: false });
}
export async function POST(request: Request) {
  const userId = await getAuthorizedUserId();
  if (!userId) return json({ message: "Sign in required." }, 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ message: "Invalid connection request." }, 400);
  const cookieStore = await cookies();
  try {
    if (parsed.data.action === "connect") {
      const auth = newRobinhoodAuthorization();
      const values = { userId, stateHash: oauthHash(auth.state), browserHash: oauthHash(auth.browser),
        verifierEncrypted: encryptSecret(auth.verifier), expiresAt: new Date(Date.now() + 30 * 60_000) };
      await db.insert(robinhoodOauthAttempts).values(values).onConflictDoUpdate({ target: robinhoodOauthAttempts.userId, set: values });
      cookieStore.set(ROBINHOOD_COOKIE, auth.browser, { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 1800 });
      return json({ url: auth.url });
    }
    const browser = cookieStore.get(ROBINHOOD_COOKIE)?.value;
    if (!browser) return json({ message: "Connection session expired. Return to DCA Bots and connect again." }, 400);
    // Atomic single-use claim prevents replay and concurrent exchanges of the same code.
    const attempt = await claimRobinhoodAuthorization(userId, parsed.data.state, browser);
    if (!attempt) return json({ message: "Connection session expired or already used. Please connect again." }, 400);
    cookieStore.delete(ROBINHOOD_COOKIE);
    const tokens = await exchangeRobinhoodCode(parsed.data.code, decryptSecret(attempt.verifierEncrypted));
    const values = { userId, tokensEncrypted: encryptSecret(JSON.stringify(tokens)), expiresAt: new Date(Date.now() + tokens.expires_in * 1000), updatedAt: new Date() };
    await db.insert(robinhoodConnections).values(values).onConflictDoUpdate({ target: robinhoodConnections.userId, set: values });
    return json({ connected: true, liveTradingEnabled: false });
  } catch {
    return json({ message: "Could not complete the Robinhood connection. Please return to DCA Bots and try connecting again." }, 502);
  }
}
