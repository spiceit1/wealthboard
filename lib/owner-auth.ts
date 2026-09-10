import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { cookies, headers } from "next/headers";
import { getDemoUserId } from "@/services/dashboardData";
import { MFA_COOKIE, validMfaSession } from "@/lib/mfa-session";

export async function getIdentityOwner() {
  const ownerEmail = process.env.WEALTHBOARD_OWNER_EMAIL?.toLowerCase();
  const token = (await cookies()).get("nf_jwt")?.value;
  if (!ownerEmail || !token) return null;
  const requestHeaders = await headers();
  const allowedOrigins = [process.env.APP_URL, process.env.URL, process.env.DEPLOY_PRIME_URL].filter(Boolean).map(url => new URL(url!).origin);
  const origin = requestHeaders.get("origin");
  if (requestHeaders.get("sec-fetch-site") === "cross-site" || (origin && !allowedOrigins.includes(origin))) return null;
  const site = process.env.URL ?? process.env.APP_URL;
  if (!site?.startsWith("https://")) return null;
  try {
    // Validate with the Identity service; never trust decoded, unsigned JWT claims.
    const response = await fetch(new URL("/.netlify/identity/user", site), {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (user.email?.toLowerCase() !== ownerEmail || !user.confirmed_at || !user.id) return null;
    return { id: String(user.id), email: ownerEmail };
  } catch { return null; }
}
export async function getAuthorizedUserId() {
  const identity = await getIdentityOwner();
  if (!identity || !validMfaSession((await cookies()).get(MFA_COOKIE)?.value, identity.id, process.env.INTERNAL_SYNC_TOKEN ?? "")) return null;
  const id = await getDemoUserId();
  if (!id) return null;
  const row = await db.query.users.findFirst({ where: eq(users.id,id), columns: { mfaEnabled: true, dataDeletionPending: true } });
  return row?.mfaEnabled && !row.dataDeletionPending ? id : null;
}
