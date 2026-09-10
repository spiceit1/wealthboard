import assert from "node:assert/strict";
import { generate, generateSecret } from "otplib";
import { verifyAuthenticatorCode } from "../lib/authenticator";

async function main() {
  const secret = generateSecret();
  const token = await generate({ secret });
  const first = await verifyAuthenticatorCode(secret, token, -1);
  assert.equal(first.valid, true, "First-time enrollment accepts a valid code");
  assert.ok("timeStep" in first);
  const replay = await verifyAuthenticatorCode(secret, token, first.timeStep);
  assert.equal(replay.valid, false, "An accepted code cannot be replayed");
  const otherToken = await generate({ secret: generateSecret() });
  if (otherToken !== token) {
    assert.equal((await verifyAuthenticatorCode(secret, otherToken, -1)).valid, false);
  }
  console.log("Authenticator enrollment and replay checks passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
