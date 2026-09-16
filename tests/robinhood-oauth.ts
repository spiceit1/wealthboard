import assert from "node:assert/strict";
import { newRobinhoodAuthorization, oauthHash, ROBINHOOD_CALLBACK, ROBINHOOD_RESOURCE, robinhoodTokenSchema, exchangeRobinhoodCode } from "../lib/robinhood-oauth";
async function main() {
  const a = newRobinhoodAuthorization(), b = newRobinhoodAuthorization();
  assert.notEqual(a.state, b.state); assert.notEqual(a.browser, b.browser);
  const url = new URL(a.url);
  assert.equal(url.origin, "https://robinhood.com");
  assert.equal(url.searchParams.get("redirect_uri"), ROBINHOOD_CALLBACK);
  assert.equal(url.searchParams.get("resource"), ROBINHOOD_RESOURCE);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), oauthHash(a.verifier));
  assert(!a.url.includes(a.verifier)); assert(!a.url.includes(a.browser));
  assert(!robinhoodTokenSchema.safeParse({ access_token: "test", expires_in: -1, token_type: "Bearer" }).success);
  assert(!robinhoodTokenSchema.safeParse({ access_token: "test", expires_in: 60, token_type: "Other" }).success);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.robinhood.com/oauth2/token/");
      assert.equal(init?.redirect, "error");
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("resource"), ROBINHOOD_RESOURCE);
      assert.equal(body.get("code_verifier"), a.verifier);
      return Response.json({ access_token: "synthetic", token_type: "Bearer", expires_in: 60 });
    };
    assert.equal((await exchangeRobinhoodCode("synthetic-code", a.verifier)).access_token, "synthetic");
    globalThis.fetch = async () => new Response("sensitive-upstream-details", {status:400});
    await assert.rejects(() => exchangeRobinhoodCode("bad", a.verifier), e => e instanceof Error && !e.message.includes("sensitive-upstream-details"));
  } finally { globalThis.fetch = originalFetch; }
  console.log("Robinhood OAuth PKCE, resource binding, token validation and error redaction passed.");
}
void main();
