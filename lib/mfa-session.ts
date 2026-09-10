import { createHmac, timingSafeEqual } from "node:crypto";
export const MFA_COOKIE = "wb_mfa";
export const MFA_MAX_AGE = 8 * 60 * 60;
export function signMfaSession(id: string, key: string, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ id, expires: now + MFA_MAX_AGE * 1000 })).toString("base64url");
  return `${data}.${createHmac("sha256", key).update(data).digest("base64url")}`;
}
export function validMfaSession(value: string | undefined, id: string, key: string, now = Date.now()) {
  if (!value || !key) return false;
  try {
    const [data, signature, extra] = value.split(".");
    if (extra || !data || !signature) return false;
    const expected = createHmac("sha256", key).update(data).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString());
    return parsed.id === id && typeof parsed.expires === "number" && parsed.expires > now && parsed.expires <= now + MFA_MAX_AGE * 1000;
  } catch { return false; }
}
