import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { accounts, connections, plaidItems, providerTokens } from "@/db/schema";
import { getPlaidClient } from "@/lib/plaid";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

export type PlaidItemToken = {
  itemId: string;
  accessToken: string;
};

/**
 * All Plaid Items linked for this user (TD, Bask, etc.). Each Item has its own access token.
 */
export async function getPlaidAccessTokensForUser(userId: string): Promise<PlaidItemToken[]> {
  const rows = await db.query.plaidItems.findMany({
    where: eq(plaidItems.userId, userId),
  });
  if (rows.length > 0) {
    return rows.map((r) => ({
      itemId: r.itemId,
      accessToken: decryptSecret(r.accessTokenEncrypted),
    }));
  }

  // Legacy: single `provider_tokens` row (pre–multi-Item). Migrate on read via Plaid item/get.
  const legacy = await db.query.providerTokens.findFirst({
    where: and(eq(providerTokens.userId, userId), eq(providerTokens.provider, "plaid")),
  });
  if (!legacy?.accessTokenEncrypted) {
    return [];
  }

  const accessToken = decryptSecret(legacy.accessTokenEncrypted);
  try {
    const client = getPlaidClient();
    const itemResp = await client.itemGet({ access_token: accessToken });
    const itemId = itemResp.data.item.item_id;
    const institutionId = itemResp.data.item.institution_id ?? null;

    await db
      .insert(plaidItems)
      .values({
        userId,
        itemId,
        accessTokenEncrypted: legacy.accessTokenEncrypted,
        institutionId,
      })
      .onConflictDoUpdate({
        target: [plaidItems.userId, plaidItems.itemId],
        set: {
          accessTokenEncrypted: encryptSecret(accessToken),
          institutionId,
          updatedAt: new Date(),
        },
      });

    await db
      .delete(providerTokens)
      .where(and(eq(providerTokens.userId, userId), eq(providerTokens.provider, "plaid")));

    return [{ itemId, accessToken }];
  } catch {
    // Plaid call failed (e.g. invalid token); return legacy single token without item id for best-effort fetch
    const conn = await db.query.connections.findFirst({
      where: and(eq(connections.userId, userId), eq(connections.provider, "plaid")),
    });
    const fallbackItemId = conn?.externalId ?? "legacy";
    return [{ itemId: fallbackItemId, accessToken }];
  }
}

export async function savePlaidAccessToken(params: {
  userId: string;
  itemId: string;
  accessToken: string;
  institutionName?: string | null;
  institutionId?: string | null;
}) {
  const {
    userId,
    itemId,
    accessToken,
    institutionName,
    institutionId,
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

  await db
    .insert(plaidItems)
    .values({
      userId,
      itemId,
      accessTokenEncrypted: encryptSecret(accessToken),
      institutionId: institutionId ?? null,
    })
    .onConflictDoUpdate({
      target: [plaidItems.userId, plaidItems.itemId],
      set: {
        accessTokenEncrypted: encryptSecret(accessToken),
        institutionId: institutionId ?? null,
        updatedAt: new Date(),
      },
    });

  // If the same institution is relinked, keep the newest Item and remove older ones for that institution.
  if (institutionName) {
    const plaidConnections = await db.query.connections.findMany({
      where: and(eq(connections.userId, userId), eq(connections.provider, "plaid")),
    });
    const normalized = institutionName.trim().toLowerCase();
    const staleSameInstitution = plaidConnections.filter(
      (c) => c.externalId !== itemId && c.displayName.trim().toLowerCase() === normalized,
    );
    for (const stale of staleSameInstitution) {
      await db.delete(accounts).where(eq(accounts.connectionId, stale.id));
      await db
        .delete(plaidItems)
        .where(and(eq(plaidItems.userId, userId), eq(plaidItems.itemId, stale.externalId)));
      await db.delete(connections).where(eq(connections.id, stale.id));
    }
  }

  // Stop using legacy single-row Plaid slot in provider_tokens (avoids confusion).
  await db
    .delete(providerTokens)
    .where(and(eq(providerTokens.userId, userId), eq(providerTokens.provider, "plaid")));

  return connection;
}
