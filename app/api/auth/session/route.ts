import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIdentityOwner, getAuthorizedUserId } from "@/lib/owner-auth";
import { MFA_COOKIE } from "@/lib/mfa-session";
export async function GET() {
  const identity = await getIdentityOwner();
  return NextResponse.json({ signedIn: Boolean(identity), authorized: Boolean(identity && await getAuthorizedUserId()) }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE() {
  if (!await getIdentityOwner()) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  (await cookies()).delete(MFA_COOKIE);
  return NextResponse.json({ status: "ok" });
}
