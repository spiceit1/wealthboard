import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIdentityOwner, getAuthorizedUserId } from "@/lib/owner-auth";
import { MFA_COOKIE, mfaSessionExpiresAt } from "@/lib/mfa-session";
export async function GET() {
  const identity = await getIdentityOwner();
  const authorized = Boolean(identity && await getAuthorizedUserId());
  if (identity && authorized) {
    const jar = await cookies();
    const expires = mfaSessionExpiresAt(jar.get(MFA_COOKIE)?.value, identity.id, process.env.INTERNAL_SYNC_TOKEN ?? "");
    const token = jar.get("nf_jwt")?.value;
    // Keep the SDK's access-token cookie across browser restarts only until the
    // existing MFA session expires. Identity still validates the token itself.
    if (expires && token) jar.set("nf_jwt", token, { secure: true, sameSite: "lax", path: "/", maxAge: Math.max(1, Math.floor((expires - Date.now()) / 1000)) });
  }
  return NextResponse.json({ signedIn: Boolean(identity), authorized }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE() {
  if (!await getIdentityOwner()) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  (await cookies()).delete(MFA_COOKIE);
  return NextResponse.json({ status: "ok" });
}
