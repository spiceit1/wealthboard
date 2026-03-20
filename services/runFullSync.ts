import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  accounts,
  connections,
  dailySnapshots,
  holdings,
  prices,
  snapshotItems,
  syncRunEvents,
  syncRuns,
} from "@/db/schema";
import { env } from "@/lib/env";
import { getProviderAdapters } from "@/providers/adapters";
import type { AccountBalance, Position } from "@/providers/types";

export type SyncEvent = {
  timestamp: string;
  message: string;
};

export type SyncSummary = {
  cash: number;
  stocks: number;
  crypto: number;
  total: number;
};

export type SyncRunResult = {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  events: SyncEvent[];
  summary: SyncSummary | null;
};

type SyncTrigger = "manual" | "scheduled" | "system";
type SyncStatus = "pending" | "running" | "completed" | "failed";

const inFlightRuns = new Map<string, Promise<void>>();

function nowIso() {
  return new Date().toISOString();
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getNyDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function toMoney(value: number) {
  return value.toFixed(2);
}

async function appendEvent(
  syncRunId: string,
  order: number,
  message: string,
  provider?: "plaid" | "snaptrade" | "coingecko",
) {
  const created = new Date();
  await db.insert(syncRunEvents).values({
    syncRunId,
    provider,
    message,
    eventOrder: order,
    level: "info",
    createdAt: created,
  });

  return {
    timestamp: created.toISOString(),
    message,
  };
}

function resolveCashInstitutionLabel(account: AccountBalance): string {
  if (account.institutionName) return account.institutionName;
  if (account.name.includes("TD")) return "TD Bank";
  if (account.name.includes("BASK")) return "BASK Bank";
  return "Linked bank";
}

/** Removes rows mislabeled by an old bug (anything not TD/BASK became "Mock Institution"). */
async function removeLegacyMockInstitutionAccounts(userId: string) {
  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.institutionName, "Mock Institution")));
}

async function prunePlaidAccountsNotInFetch(
  userId: string,
  connectionId: string,
  activeProviderIds: Set<string>,
) {
  const rows = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), eq(accounts.connectionId, connectionId)),
  });
  for (const row of rows) {
    if (!activeProviderIds.has(row.providerAccountId)) {
      await db.delete(accounts).where(eq(accounts.id, row.id));
    }
  }
}

async function upsertCashAccounts(
  userId: string,
  data: AccountBalance[],
  options: { connectionId: string | null },
) {
  const { connectionId } = options;
  for (const account of data) {
    const institutionName = resolveCashInstitutionLabel(account);
    await db
      .insert(accounts)
      .values({
        userId,
        connectionId,
        providerAccountId: account.providerAccountId,
        institutionName,
        name: account.name,
        type: account.type,
        currency: account.currency,
        lastBalance: toMoney(account.balance),
        balanceAsOf: new Date(),
      })
      .onConflictDoUpdate({
        target: [accounts.userId, accounts.providerAccountId],
        set: {
          connectionId,
          institutionName,
          name: account.name,
          type: account.type,
          currency: account.currency,
          lastBalance: toMoney(account.balance),
          balanceAsOf: new Date(),
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertBrokerageHoldings(userId: string, positions: Position[]) {
  const brokerageAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.type, "brokerage")),
  });

  if (!brokerageAccount) {
    return;
  }

  await db
    .delete(holdings)
    .where(and(eq(holdings.userId, userId), eq(holdings.accountId, brokerageAccount.id)));

  if (!positions.length) {
    return;
  }

  await db.insert(holdings).values(
    positions.map((position) => ({
      userId,
      accountId: brokerageAccount.id,
      symbol: position.symbol,
      name: position.symbol,
      assetClass: position.assetClass,
      quantity: position.quantity.toFixed(8),
      lastPrice: position.price.toFixed(6),
      marketValue: toMoney(position.value),
      isManual: false,
    })),
  );

  const brokerageValue = positions.reduce((sum, position) => sum + position.value, 0);
  await db
    .update(accounts)
    .set({
      lastBalance: toMoney(brokerageValue),
      balanceAsOf: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, brokerageAccount.id));
}

async function refreshCryptoValuations(userId: string) {
  const cryptoHoldings = await db.query.holdings.findMany({
    where: and(eq(holdings.userId, userId), eq(holdings.assetClass, "crypto")),
  });

  if (!cryptoHoldings.length) {
    return { symbols: [] as string[] };
  }

  const symbols = [...new Set(cryptoHoldings.map((holding) => holding.symbol.toUpperCase()))];
  const adapters = getProviderAdapters();
  const priceResult = await adapters.coingecko.fetchPrices(symbols);
  const priceMap = new Map(priceResult.data.map((item) => [item.symbol.toUpperCase(), item.price]));

  for (const holding of cryptoHoldings) {
    const matchedPrice = priceMap.get(holding.symbol.toUpperCase());
    if (!matchedPrice) continue;

    const quantity = Number(holding.quantity);
    const marketValue = matchedPrice * quantity;

    await db
      .update(holdings)
      .set({
        lastPrice: matchedPrice.toFixed(6),
        marketValue: toMoney(marketValue),
        updatedAt: new Date(),
      })
      .where(eq(holdings.id, holding.id));

    await db.insert(prices).values({
      symbol: holding.symbol.toUpperCase(),
      assetClass: "crypto",
      currency: "USD",
      price: matchedPrice.toFixed(6),
      pricedAt: new Date(),
      source: "coingecko",
    });
  }

  const cryptoAccounts = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), eq(accounts.type, "crypto_wallet")),
  });

  for (const account of cryptoAccounts) {
    const accountHoldings = await db.query.holdings.findMany({
      where: and(eq(holdings.userId, userId), eq(holdings.accountId, account.id)),
    });
    const accountTotal = accountHoldings.reduce((sum, item) => sum + Number(item.marketValue), 0);
    await db
      .update(accounts)
      .set({
        lastBalance: toMoney(accountTotal),
        balanceAsOf: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));
  }

  return { symbols };
}

async function persistSnapshot(userId: string, syncRunId: string): Promise<SyncSummary | null> {
  const cashRows = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), inArray(accounts.type, ["checking", "savings"])),
  });
  const stockRows = await db.query.holdings.findMany({
    where: and(eq(holdings.userId, userId), eq(holdings.assetClass, "stock")),
  });
  const cryptoRows = await db.query.holdings.findMany({
    where: and(eq(holdings.userId, userId), eq(holdings.assetClass, "crypto")),
  });

  const cash = cashRows.reduce((sum, row) => sum + Number(row.lastBalance), 0);
  const stocks = stockRows.reduce((sum, row) => sum + Number(row.marketValue), 0);
  const crypto = cryptoRows.reduce((sum, row) => sum + Number(row.marketValue), 0);
  const total = cash + stocks + crypto;

  const dateKey = toDateKey(new Date());
  const previous = await db
    .select({ total: dailySnapshots.totalNetWorth })
    .from(dailySnapshots)
    .where(eq(dailySnapshots.userId, userId))
    .orderBy(desc(dailySnapshots.snapshotDate))
    .limit(1);
  const prevTotal = previous[0] ? Number(previous[0].total) : total;
  const dailyChange = total - prevTotal;

  await db
    .insert(dailySnapshots)
    .values({
      userId,
      snapshotDate: dateKey,
      cashTotal: toMoney(cash),
      stocksTotal: toMoney(stocks),
      cryptoTotal: toMoney(crypto),
      totalNetWorth: toMoney(total),
      dailyChange: toMoney(dailyChange),
      syncRunId,
    })
    .onConflictDoUpdate({
      target: [dailySnapshots.userId, dailySnapshots.snapshotDate],
      set: {
        cashTotal: toMoney(cash),
        stocksTotal: toMoney(stocks),
        cryptoTotal: toMoney(crypto),
        totalNetWorth: toMoney(total),
        dailyChange: toMoney(dailyChange),
        syncRunId,
        createdAt: new Date(),
      },
    });

  const snapshot = await db.query.dailySnapshots.findFirst({
    where: and(eq(dailySnapshots.userId, userId), eq(dailySnapshots.snapshotDate, dateKey)),
  });
  if (!snapshot) return null;

  await db.delete(snapshotItems).where(eq(snapshotItems.snapshotId, snapshot.id));

  if (cashRows.length) {
    await db.insert(snapshotItems).values(
      cashRows.map((row) => ({
        snapshotId: snapshot.id,
        category: "cash_account" as const,
        accountId: row.id,
        label: row.name,
        value: row.lastBalance,
        currency: row.currency,
      })),
    );
  }
  if (stockRows.length) {
    await db.insert(snapshotItems).values(
      stockRows.map((row) => ({
        snapshotId: snapshot.id,
        category: "brokerage_position" as const,
        accountId: row.accountId,
        holdingId: row.id,
        label: row.name,
        symbol: row.symbol,
        quantity: row.quantity,
        price: row.lastPrice,
        value: row.marketValue,
      })),
    );
  }
  if (cryptoRows.length) {
    await db.insert(snapshotItems).values(
      cryptoRows.map((row) => ({
        snapshotId: snapshot.id,
        category: "crypto_holding" as const,
        accountId: row.accountId,
        holdingId: row.id,
        label: row.name,
        symbol: row.symbol,
        quantity: row.quantity,
        price: row.lastPrice,
        value: row.marketValue,
      })),
    );
  }

  return { cash, stocks, crypto, total };
}

async function executeFullSync(syncRunId: string, userId: string): Promise<SyncRunResult> {
  const events: SyncEvent[] = [];
  let order = 1;
  let summary: SyncSummary | null = null;
  const adapters = getProviderAdapters();

  const pushEvent = async (
    message: string,
    provider?: "plaid" | "snaptrade" | "coingecko",
  ) => {
    const event = await appendEvent(syncRunId, order, message, provider);
    order += 1;
    events.push(event);
  };

  await pushEvent("Starting sync job");

  try {
    try {
      await pushEvent("Fetching Plaid bank balances", "plaid");
      const plaid = await adapters.plaid.fetchBalances(userId);
      await removeLegacyMockInstitutionAccounts(userId);
      const plaidConnection = await db.query.connections.findFirst({
        where: and(eq(connections.userId, userId), eq(connections.provider, "plaid")),
      });
      const plaidConnectionId = plaidConnection?.id ?? null;
      await upsertCashAccounts(userId, plaid.data, { connectionId: plaidConnectionId });
      if (plaidConnectionId) {
        await prunePlaidAccountsNotInFetch(
          userId,
          plaidConnectionId,
          new Set(plaid.data.map((a) => a.providerAccountId)),
        );
      }
      for (const account of plaid.data) {
        await pushEvent(`Saved ${account.name} balance`, "plaid");
      }
    } catch (error) {
      await pushEvent(
        `Plaid sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "plaid",
      );
    }

    try {
      await pushEvent("Fetching Robinhood portfolio", "snaptrade");
      const broker = await adapters.snaptrade.fetchPositions();
      await upsertBrokerageHoldings(userId, broker.data);
      await pushEvent(`Retrieved ${broker.data.length} positions`, "snaptrade");
    } catch (error) {
      await pushEvent(
        `Robinhood sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "snaptrade",
      );
    }

    try {
      await pushEvent("Fetching crypto prices", "coingecko");
      const result = await refreshCryptoValuations(userId);
      await pushEvent(`Updated ${result.symbols.length} crypto prices`, "coingecko");
    } catch (error) {
      await pushEvent(
        `Crypto sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "coingecko",
      );
    }

    await pushEvent("Calculating net worth");
    summary = await persistSnapshot(userId, syncRunId);
    await pushEvent("Saving snapshot");

    await db
      .update(syncRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(syncRuns.id, syncRunId));
    await pushEvent("Sync complete");

    return {
      runId: syncRunId,
      status: "completed",
      events,
      summary,
    };
  } catch (error) {
    await db
      .update(syncRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown sync error",
      })
      .where(eq(syncRuns.id, syncRunId));
    await pushEvent("Sync failed");
    return {
      runId: syncRunId,
      status: "failed",
      events,
      summary,
    };
  }
}

export async function createSyncRun(userId: string, trigger: SyncTrigger = "manual") {
  const running = await db.query.syncRuns.findFirst({
    where: and(eq(syncRuns.userId, userId), eq(syncRuns.status, "running")),
    orderBy: (table, { desc: descFn }) => [descFn(table.startedAt)],
  });

  if (running) {
    return {
      runId: running.id,
      status: running.status as SyncStatus,
      started: false,
      skipped: true,
      skipReason: "A sync run is already in progress.",
    };
  }

  if (trigger === "scheduled") {
    const recentScheduledRuns = await db
      .select({
        id: syncRuns.id,
        status: syncRuns.status,
        startedAt: syncRuns.startedAt,
      })
      .from(syncRuns)
      .where(and(eq(syncRuns.userId, userId), eq(syncRuns.trigger, "scheduled")))
      .orderBy(desc(syncRuns.startedAt))
      .limit(20);

    const nyToday = getNyDateKey(new Date());
    const alreadyRanToday = recentScheduledRuns.find((run) => {
      const key = getNyDateKey(run.startedAt);
      return (
        key === nyToday &&
        (run.status === "running" ||
          run.status === "pending" ||
          run.status === "completed")
      );
    });

    if (alreadyRanToday) {
      return {
        runId: alreadyRanToday.id,
        status: alreadyRanToday.status as SyncStatus,
        started: false,
        skipped: true,
        skipReason: "Scheduled sync already ran for current America/New_York day.",
      };
    }
  }

  const [created] = await db
    .insert(syncRuns)
    .values({
      userId,
      status: "running",
      trigger,
      isMock: env.MOCK_MODE,
      startedAt: new Date(),
    })
    .returning();

  return { runId: created.id, status: created.status as SyncStatus, started: true };
}

export async function runFullSync(userId: string, trigger: SyncTrigger = "manual") {
  const run = await createSyncRun(userId, trigger);
  if (run.started) {
    const promise = executeFullSync(run.runId, userId).then(() => undefined);
    inFlightRuns.set(run.runId, promise);
    await promise.finally(() => inFlightRuns.delete(run.runId));
  }
  return getSyncRunProgress(run.runId);
}

export async function triggerSyncInBackground(userId: string, trigger: SyncTrigger = "manual") {
  const run = await createSyncRun(userId, trigger);
  if (run.started) {
    const promise = executeFullSync(run.runId, userId).then(() => undefined);
    inFlightRuns.set(run.runId, promise);
    void promise.finally(() => inFlightRuns.delete(run.runId));
  }
  return run;
}

export async function getSyncRunProgress(runId: string): Promise<SyncRunResult> {
  const run = await db.query.syncRuns.findFirst({
    where: eq(syncRuns.id, runId),
  });
  if (!run) {
    return {
      runId,
      status: "failed",
      events: [{ timestamp: nowIso(), message: "Sync run not found" }],
      summary: null,
    };
  }

  const events = await db
    .select({
      timestamp: syncRunEvents.createdAt,
      message: syncRunEvents.message,
    })
    .from(syncRunEvents)
    .where(eq(syncRunEvents.syncRunId, runId))
    .orderBy(asc(syncRunEvents.eventOrder));

  const snapshot = await db.query.dailySnapshots.findFirst({
    where: eq(dailySnapshots.syncRunId, runId),
    orderBy: (table, { desc: descFn }) => [descFn(table.createdAt)],
  });
  const summary = snapshot
    ? {
        cash: Number(snapshot.cashTotal),
        stocks: Number(snapshot.stocksTotal),
        crypto: Number(snapshot.cryptoTotal),
        total: Number(snapshot.totalNetWorth),
      }
    : null;

  return {
    runId,
    status: run.status,
    events: events.map((event) => ({
      timestamp: event.timestamp?.toISOString() ?? nowIso(),
      message: event.message,
    })),
    summary,
  };
}
