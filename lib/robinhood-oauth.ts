import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

// Public client registered with Robinhood for this exact callback, not the chat client.
export const ROBINHOOD_CLIENT_ID = "LtLiNmbs9owbYfWgBlC68Z2VujIPuvGoAiSYr8xW";
export const ROBINHOOD_RESOURCE = "https://agent.robinhood.com/mcp/trading";
export const ROBINHOOD_CALLBACK = "https://dougwealthboard.netlify.app/bots/robinhood/callback";
export const ROBINHOOD_COOKIE = "__Host-wb_rh_oauth";
export const oauthHash = (value: string) => createHash("sha256").update(value).digest("base64url");
export function newRobinhoodAuthorization() {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const browser = randomBytes(32).toString("base64url");
  const url = new URL("https://robinhood.com/oauth");
  url.search = new URLSearchParams({ response_type: "code", client_id: ROBINHOOD_CLIENT_ID,
    redirect_uri: ROBINHOOD_CALLBACK, scope: "internal", resource: ROBINHOOD_RESOURCE,
    state, code_challenge: oauthHash(verifier), code_challenge_method: "S256" }).toString();
  return { state, verifier, browser, url: url.toString() };
}
export const robinhoodTokenSchema = z.object({
  access_token: z.string().min(1), refresh_token: z.string().min(1).optional(),
  token_type: z.string().refine(value => value.toLowerCase() === "bearer"),
  expires_in: z.coerce.number().int().positive().max(31_536_000),
});
export async function exchangeRobinhoodCode(code: string, verifier: string) {
  const response = await fetch("https://api.robinhood.com/oauth2/token/", {
    method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier,
      client_id: ROBINHOOD_CLIENT_ID, redirect_uri: ROBINHOOD_CALLBACK, resource: ROBINHOOD_RESOURCE }),
  });
  // Never forward upstream bodies: they may include credentials or personal data.
  if (!response.ok) throw new Error("Robinhood did not complete authorization. Please start a new connection.");
  return robinhoodTokenSchema.parse(await response.json());
}
