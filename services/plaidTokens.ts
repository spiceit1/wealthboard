import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { accounts, connections, providerTokens } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

export async function getPlaidAccessToken(userId: string) {
  const token = await db.query.providerTokens.findFirst({
    where: and(eq(providerTokens.userId, userId), eq(providerTokens.provider, "plaid")),
  });

  if (!token?.accessTokenEncrypted) {
    return null;
  }

  return decryptSecret(token.accessTokenEncrypted);
}

export async function savePlaidAccessToken(params: {
  userId: string;
  itemId: string;
  accessToken: string;
  institutionName?: string | null;
  institutionId?: string | null;
  scopes?: string[];
}) {
  const {
    userId,
    itemId,
    accessToken,
    institutionName,
    institutionId,
    scopes = ["accounts:read", "balances:read", "transactions:read"],
  } = params;

  const [connection] = await db
    .insert(connections)
    .values({
      userId,
      provider: "plaid",
      externalId: itemId,
      displayName: institutionName ?? "Plaid Connection",
      status: "active",
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [connections.userId, connections.provider, connections.externalId],
      set: {
        displayName: institutionName ?? "Plaid Connection",
        status: "active",
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  // Only one Plaid access token is stored per user; remove other Items' connections
  // and their accounts so we don't show duplicate bank rows from old Links.
  const stalePlaidConnections = await db.query.connections.findMany({
    where: and(
      eq(connections.userId, userId),
      eq(connections.provider, "plaid"),
      ne(connections.externalId, itemId),
    ),
  });
  for (const stale of stalePlaidConnections) {
    await db.delete(accounts).where(eq(accounts.connectionId, stale.id));
    await db.delete(connections).where(eq(connections.id, stale.id));
  }

  await db
    .insert(providerTokens)
    .values({
      userId,
      provider: "plaid",
      accessTokenEncrypted: encryptSecret(accessToken),
      refreshTokenEncrypted: institutionId ?? null,
      scopes,
    })
    .onConflictDoUpdate({
      target: [providerTokens.userId, providerTokens.provider],
      set: {
        accessTokenEncrypted: encryptSecret(accessToken),
        refreshTokenEncrypted: institutionId ?? null,
        scopes,
        updatedAt: new Date(),
      },
    });

  return connection;
}
