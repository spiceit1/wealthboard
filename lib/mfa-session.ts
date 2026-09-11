import { createHmac, timingSafeEqual } from "node:crypto";
export const MFA_COOKIE = "wb_mfa";
export const MFA_MAX_AGE = 8 * 60 * 60;
export const MFA_REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;
export function signMfaSession(id: string, key: string, now = Date.now(), rememberDevice = false) {
  const maxAge = rememberDevice ? MFA_REMEMBER_MAX_AGE : MFA_MAX_AGE;
  const data = Buffer.from(JSON.stringify({ id, expires: now + maxAge * 1000 })).toString("base64url");
  return `${data}.${createHmac("sha256", key).update(data).digest("base64url")}`;
}
export function validMfaSession(value: string | undefined, id: string, key: string, now = Date.now()) {
  return mfaSessionExpiresAt(value, id, key, now) !== null;
}
export function mfaSessionExpiresAt(value: string | undefined, id: string, key: string, now = Date.now()): number | null {
  if (!value || !key) return null;
  try {
    const [data, signature, extra] = value.split(".");
    if (extra || !data || !signature) return null;
    const expected = createHmac("sha256", key).update(data).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString());
    return parsed.id === id && typeof parsed.expires === "number" && parsed.expires > now && parsed.expires <= now + MFA_REMEMBER_MAX_AGE * 1000 ? parsed.expires : null;
  } catch { return null; }
}
