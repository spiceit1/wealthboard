import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { accounts, holdings } from "@/db/schema";

type ManualAssetClass = "stock" | "crypto";

const MANUAL_ACCOUNT_CONFIG: Record<
  ManualAssetClass,
  { providerAccountId: string; accountType: "brokerage" | "crypto_wallet"; name: string }
> = {
  stock: {
    providerAccountId: "manual-stocks",
    accountType: "brokerage",
    name: "Manual Stocks",
  },
  crypto: {
    providerAccountId: "manual-crypto",
    accountType: "crypto_wallet",
    name: "Manual Crypto",
  },
};

async function ensureManualAccount(userId: string, assetClass: ManualAssetClass) {
  const config = MANUAL_ACCOUNT_CONFIG[assetClass];
  const [account] = await db
    .insert(accounts)
    .values({
      userId,
      providerAccountId: config.providerAccountId,
      institutionName: "Manual",
      name: config.name,
      type: config.accountType,
      currency: "USD",
      lastBalance: "0.00",
    })
    .onConflictDoUpdate({
      target: [accounts.userId, accounts.providerAccountId],
      set: {
        institutionName: "Manual",
        name: config.name,
        type: config.accountType,
        updatedAt: new Date(),
      },
    })
    .returning();
  return account;
}

export async function upsertManualHolding(params: {
  userId: string;
  symbol: string;
  quantity: number;
  assetClass: ManualAssetClass;
  name?: string;
}) {
  const symbol = params.symbol.trim().toUpperCase();
  if (!symbol) {
    throw new Error("Symbol is required.");
  }

  const quantity = Number(params.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Quantity must be a non-negative number.");
  }

  if (quantity === 0) {
    await db
      .delete(holdings)
      .where(
        and(
          eq(holdings.userId, params.userId),
          eq(holdings.symbol, symbol),
          eq(holdings.assetClass, params.assetClass),
          eq(holdings.isManual, true),
        ),
      );
    return { deleted: true };
  }

  const manualAccount = await ensureManualAccount(params.userId, params.assetClass);
  const existing = await db.query.holdings.findFirst({
    where: and(
      eq(holdings.userId, params.userId),
      eq(holdings.symbol, symbol),
      eq(holdings.assetClass, params.assetClass),
      eq(holdings.isManual, true),
    ),
  });

  if (existing) {
    await db
      .update(holdings)
      .set({
        accountId: manualAccount.id,
        name: params.name?.trim() || existing.name || symbol,
        quantity: quantity.toFixed(8),
        updatedAt: new Date(),
      })
      .where(eq(holdings.id, existing.id));
    return { updated: true };
  }

  await db.insert(holdings).values({
    userId: params.userId,
    accountId: manualAccount.id,
    symbol,
    name: params.name?.trim() || symbol,
    assetClass: params.assetClass,
    quantity: quantity.toFixed(8),
    lastPrice: "0.000000",
    marketValue: "0.00",
    isManual: true,
  });

  return { created: true };
}
