import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

function getKey() {
  if (!env.INTERNAL_SYNC_TOKEN && env.NODE_ENV === "production") {
    throw new Error("INTERNAL_SYNC_TOKEN is required for secret encryption in production.");
  }
  const secret = env.INTERNAL_SYNC_TOKEN ?? "dev-fallback-key-change-me";
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
