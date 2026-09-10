import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getIdentityOwner } from "@/lib/owner-auth";
import { getDemoUserId } from "@/services/dashboardData";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { MFA_COOKIE, MFA_MAX_AGE, signMfaSession } from "@/lib/mfa-session";
export async function POST(request: Request) {
  const identity = await getIdentityOwner();
  if (!identity) return NextResponse.json({ message: "Sign in with the verified owner account first." }, { status: 401 });
  const userId = await getDemoUserId();
  if (!userId) return NextResponse.json({ message: "Account not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  let user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return NextResponse.json({ message: "Account not found." }, { status: 404 });
  if (user.mfaLockedUntil && user.mfaLockedUntil.getTime() > Date.now()) return NextResponse.json({ message: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  if (body.action === "setup") {
    if (user.mfaEnabled) return NextResponse.json({ enrolled: true });
    if (!user.mfaSecretEncrypted) {
      await db.update(users).set({ mfaSecretEncrypted: encryptSecret(generateSecret()) }).where(and(eq(users.id, userId), isNull(users.mfaSecretEncrypted)));
      user = (await db.query.users.findFirst({ where: eq(users.id, userId) }))!;
    }
    const secret = decryptSecret(user.mfaSecretEncrypted!);
    const uri = generateURI({ issuer: "WealthBoard", label: identity.email, secret });
    return NextResponse.json({ enrolled: false, qr: await QRCode.toDataURL(uri), secret }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!/^\d{6}$/.test(body.code ?? "") || !user.mfaSecretEncrypted) return NextResponse.json({ message: "Enter your six-digit authenticator code." }, { status: 400 });
  const result = await verify({ secret: decryptSecret(user.mfaSecretEncrypted), token: body.code, epochTolerance: 30, afterTimeStep: user.mfaLastStep });
  if (!result.valid || !("timeStep" in result)) {
    await db.update(users).set({
      mfaFailures: sql`CASE WHEN ${users.mfaLockedUntil} < now() THEN 1 ELSE ${users.mfaFailures} + 1 END`,
      mfaLockedUntil: sql`CASE WHEN ${users.mfaLockedUntil} < now() THEN NULL WHEN ${users.mfaFailures} >= 4 THEN now() + interval '15 minutes' ELSE NULL END`,
    }).where(eq(users.id, userId));
    console.warn("WealthBoard MFA verification failed");
    return NextResponse.json({ message: "Invalid or already-used code. Wait for a new code and try again." }, { status: 401 });
  }
  const [saved] = await db.update(users).set({ mfaEnabled: true, mfaLastStep: result.timeStep, mfaFailures: 0, mfaLockedUntil: null })
    .where(and(eq(users.id, userId), lt(users.mfaLastStep, result.timeStep))).returning({ id: users.id });
  if (!saved) return NextResponse.json({ message: "Code already used. Wait for a new code." }, { status: 401 });
  const key = process.env.INTERNAL_SYNC_TOKEN;
  if (!key) return NextResponse.json({ message: "Security configuration missing." }, { status: 503 });
  (await cookies()).set(MFA_COOKIE, signMfaSession(identity.id, key), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: MFA_MAX_AGE });
  console.info("WealthBoard MFA verification succeeded");
  return NextResponse.json({ status: "ok" });
}
