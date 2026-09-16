import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users, robinhoodOauthAttempts, robinhoodConnections } from "../db/schema";
import { claimRobinhoodAuthorization } from "../services/robinhoodAuthorization";
import { newRobinhoodAuthorization, oauthHash } from "../lib/robinhood-oauth";
import { encryptSecret, decryptSecret } from "../lib/secrets";
async function main() {
  if (!new URL(process.env.DATABASE_URL ?? "").hostname.startsWith("ep-sweet-shadow-ahkyiy46")) throw new Error("Isolated test branch required");
  const userId = randomUUID(), auth = newRobinhoodAuthorization();
  await db.insert(users).values({id:userId,email:`${userId}@test.invalid`,fullName:"OAuth test"});
  const values = {userId,stateHash:oauthHash(auth.state),browserHash:oauthHash(auth.browser),verifierEncrypted:encryptSecret(auth.verifier),expiresAt:new Date(Date.now()+60_000)};
  await db.insert(robinhoodOauthAttempts).values(values);
  assert.equal(await claimRobinhoodAuthorization(randomUUID(),auth.state,auth.browser),null);
  assert.equal(await claimRobinhoodAuthorization(userId,"wrong",auth.browser),null);
  assert.equal(await claimRobinhoodAuthorization(userId,auth.state,"wrong"),null);
  const claims = await Promise.all([claimRobinhoodAuthorization(userId,auth.state,auth.browser),claimRobinhoodAuthorization(userId,auth.state,auth.browser)]);
  assert.equal(claims.filter(Boolean).length,1);
  assert.equal(decryptSecret(claims.find(Boolean)!.verifierEncrypted),auth.verifier);
  assert.equal(await claimRobinhoodAuthorization(userId,auth.state,auth.browser),null);
  await db.insert(robinhoodOauthAttempts).values({...values,expiresAt:new Date(Date.now()-1000)});
  assert.equal(await claimRobinhoodAuthorization(userId,auth.state,auth.browser),null);
  await db.insert(robinhoodConnections).values({userId,tokensEncrypted:encryptSecret("synthetic-token"),expiresAt:new Date()});
  const stored = await db.query.robinhoodConnections.findFirst({where:eq(robinhoodConnections.userId,userId)});
  assert(stored); assert(!stored.tokensEncrypted.includes("synthetic-token"));
  console.log("OAuth owner/browser/state isolation, expiry, single-use concurrent claim and encrypted storage passed.");
}
void main();
