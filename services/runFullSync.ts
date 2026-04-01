import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  accounts,
  connections,
  dailySnapshots,
  holdings,
  intradaySnapshots,
  prices,
  snapshotItems,
  syncRunEvents,
  syncRuns,
} from "@/db/schema";
import { env } from "@/lib/env";
import { getProviderAdapterModes, getProviderAdapters } from "@/providers/adapters";
import type { AccountBalance } from "@/providers/types";

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

type SnapshotOverride = Partial<Pick<SyncSummary, "cash" | "stocks" | "crypto">>;

export type SyncRunResult = {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  events: SyncEvent[];
  summary: SyncSummary | null;
};

type SyncTrigger = "manual" | "scheduled" | "system";
type SyncStatus = "pending" | "running" | "completed" | "failed";

const inFlightRuns = new Map<string, Promise<void>>();
const RUN_STALE_AFTER_MS = 20 * 60 * 1000;
const PLAID_FETCH_TIMEOUT_MS = 25_000;
const PLAID_FETCH_TIMEOUT_MS_SCHEDULED = 7_000;
const COINGECKO_FETCH_TIMEOUT_MS = 20_000;
const STOOQ_FETCH_TIMEOUT_MS = 6_000;
const PROVIDER_RETRY_COUNT = 2;

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

function getNyHour(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(value);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

async function withRetry<T>(
  task: () => Promise<T>,
  attempts: number,
  retryDelayMs: number,
): Promise<T> {
  let lastError: unknown = null;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (index < attempts - 1) await sleep(retryDelayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Provider call failed");
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

/** Same bank account relinked via a new Plaid Item gets a new account_id — drops duplicate display rows. */
async function dedupeCashAccountsByDisplayKey(userId: string, winningProviderIds: Set<string>) {
  const rows = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), inArray(accounts.type, ["checking", "savings"])),
  });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.institutionName.trim().toLowerCase()}|${row.name.trim().toLowerCase()}|${row.type}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => {
      const aWin = winningProviderIds.has(a.providerAccountId) ? 1 : 0;
      const bWin = winningProviderIds.has(b.providerAccountId) ? 1 : 0;
      if (bWin !== aWin) return bWin - aWin;
      const aTime = a.balanceAsOf?.getTime() ?? 0;
      const bTime = b.balanceAsOf?.getTime() ?? 0;
      return bTime - aTime;
    });
    const [, ...duplicates] = list;
    for (const dup of duplicates) {
      await db.delete(accounts).where(eq(accounts.id, dup.id));
    }
  }
}

async function resolvePlaidConnectionId(userId: string, plaidItemId: string | undefined) {
  if (!plaidItemId) return null;
  const conn = await db.query.connections.findFirst({
    where: and(
      eq(connections.userId, userId),
      eq(connections.provider, "plaid"),
      eq(connections.externalId, plaidItemId),
    ),
  });
  return conn?.id ?? null;
}

async function upsertCashAccounts(userId: string, data: AccountBalance[]) {
  for (const account of data) {
    const connectionId = await resolvePlaidConnectionId(userId, account.plaidItemId);
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

async function markPlaidConnectionsSynced(userId: string, plaidItemIds: string[]) {
  const uniqueIds = [...new Set(plaidItemIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  await db
    .update(connections)
    .set({
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
      status: "active",
    })
    .where(
      and(
        eq(connections.userId, userId),
        eq(connections.provider, "plaid"),
        inArray(connections.externalId, uniqueIds),
      ),
    );
}

async function removeAutoStockHoldings(userId: string) {
  await db
    .delete(holdings)
    .where(and(eq(holdings.userId, userId), eq(holdings.assetClass, "stock"), eq(holdings.isManual, false)));
}

type StockQuote = { price: number; pricedAt: Date };

function datePartsInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "0"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "0"),
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
    second: Number(parts.find((part) => part.type === "second")?.value ?? "0"),
  };
}

function parseLocalTimeInZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  // Convert local wall-clock time in `timeZone` to UTC Date.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 2; i += 1) {
    const zoned = datePartsInTimeZone(new Date(utcMs), timeZone);
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const zonedMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    utcMs += desiredMs - zonedMs;
  }
  return new Date(utcMs);
}

async function fetchStockQuoteStooq(symbol: string): Promise<StockQuote | null> {
  const normalized = symbol.trim().toLowerCase();
  if (!normalized) return null;
  const candidates = [`${normalized}.us`, normalized];
  for (const ticker of candidates) {
    const response = await withRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), STOOQ_FETCH_TIMEOUT_MS);
        try {
          return await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(ticker)}&i=d`, {
            cache: "no-store",
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      },
      PROVIDER_RETRY_COUNT,
      250,
    );
    if (!response.ok) continue;
    const csv = (await response.text()).trim();
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (!lines.length) continue;
    // Stooq may return either header+row or only one data row.
    const row = lines.length > 1 ? lines[1] : lines[0];
    const columns = row.split(",");
    // Stooq CSV columns: symbol,date,time,open,high,low,close,volume
    // Use close/last trade price, not intraday high.
    const close = Number(columns[6]);
    const fallback = Number(columns[4]);
    const price = Number.isFinite(close) && close > 0 ? close : fallback;
    if (!Number.isFinite(price) || price <= 0) continue;
    const dateRaw = (columns[1] ?? "").trim();
    const timeRaw = (columns[2] ?? "").trim();
    let pricedAt = new Date();
    if (/^\d{8}$/.test(dateRaw) && /^\d{6}$/.test(timeRaw)) {
      const year = Number(dateRaw.slice(0, 4));
      const month = Number(dateRaw.slice(4, 6));
      const day = Number(dateRaw.slice(6, 8));
      const hour = Number(timeRaw.slice(0, 2));
      const minute = Number(timeRaw.slice(2, 4));
      const second = Number(timeRaw.slice(4, 6));
      // Stooq timestamps are local to Europe/Warsaw trading calendar.
      const parsed = parseLocalTimeInZone(year, month, day, hour, minute, second, "Europe/Warsaw");
      if (Number.isFinite(parsed.getTime())) {
        pricedAt = parsed;
      }
    }
    return { price, pricedAt };
  }
  return null;
}

async function fetchStockPrices(symbols: string[]) {
  const map = new Map<string, StockQuote>();
  for (const symbol of symbols) {
    try {
      const quote = await fetchStockQuoteStooq(symbol);
      if (quote) map.set(symbol.toUpperCase(), quote);
    } catch {
      // best-effort pricing only
    }
  }
  return map;
}

async function refreshManualHoldingValuations(userId: string) {
  const manualRows = await db.query.holdings.findMany({
    where: and(eq(holdings.userId, userId), eq(holdings.isManual, true)),
  });

  if (!manualRows.length) {
    return { stockSymbols: [] as string[], cryptoSymbols: [] as string[] };
  }

  const stockSymbols = [...new Set(
    manualRows.filter((h) => h.assetClass === "stock").map((h) => h.symbol.toUpperCase()),
  )];
  const cryptoSymbols = [...new Set(
    manualRows.filter((h) => h.assetClass === "crypto").map((h) => h.symbol.toUpperCase()),
  )];

  const stockPriceMap = await fetchStockPrices(stockSymbols);
  const adapters = getProviderAdapters();
  const cryptoPriceResult = await withRetry(
    () =>
      withTimeout(
        adapters.coingecko.fetchPrices(cryptoSymbols),
        COINGECKO_FETCH_TIMEOUT_MS,
        "CoinGecko request timed out.",
      ),
    PROVIDER_RETRY_COUNT,
    400,
  );
  const cryptoPriceMap = new Map(cryptoPriceResult.data.map((item) => [item.symbol.toUpperCase(), item.price]));

  let updatedStockCount = 0;
  let updatedCryptoCount = 0;

  for (const holding of manualRows) {
    const symbol = holding.symbol.toUpperCase();
    const stockQuote = stockPriceMap.get(symbol);
    const cryptoPrice = cryptoPriceMap.get(symbol);
    const matchedPrice = holding.assetClass === "stock" ? stockQuote?.price : cryptoPrice;
    if (!matchedPrice) continue;

    const quantity = Number(holding.quantity);
    const marketValue = matchedPrice * quantity;
    const pricedAt = holding.assetClass === "stock" ? (stockQuote?.pricedAt ?? new Date()) : new Date();

    await db
      .update(holdings)
      .set({
        lastPrice: matchedPrice.toFixed(6),
        marketValue: toMoney(marketValue),
        updatedAt: pricedAt,
      })
      .where(eq(holdings.id, holding.id));

    await db
      .insert(prices)
      .values({
        symbol,
        assetClass: holding.assetClass,
        currency: "USD",
        price: matchedPrice.toFixed(6),
        pricedAt,
        source: holding.assetClass === "stock" ? "snaptrade" : "coingecko",
      })
      .onConflictDoNothing();
    if (holding.assetClass === "stock") updatedStockCount += 1;
    if (holding.assetClass === "crypto") updatedCryptoCount += 1;
  }

  const rowsByAccount = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), inArray(accounts.type, ["brokerage", "crypto_wallet"])),
  });

  for (const account of rowsByAccount) {
    const accountHoldings = await db.query.holdings.findMany({
      where: and(eq(holdings.userId, userId), eq(holdings.accountId, account.id), eq(holdings.isManual, true)),
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

  return { stockSymbols, cryptoSymbols, updatedStockCount, updatedCryptoCount };
}

async function persistSnapshot(
  userId: string,
  syncRunId: string,
  options?: { persistDailySnapshot?: boolean; snapshotOverride?: SnapshotOverride | null },
): Promise<SyncSummary | null> {
  const persistDailySnapshot = options?.persistDailySnapshot ?? true;
  const cashRows = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), inArray(accounts.type, ["checking", "savings"])),
  });
  const stockRows = await db.query.holdings.findMany({
    where: and(eq(holdings.userId, userId), eq(holdings.assetClass, "stock")),
  });
  const cryptoRows = await db.query.holdings.findMany({
    where: and(eq(holdings.userId, userId), eq(holdings.assetClass, "crypto")),
  });

  const liveCash = cashRows.reduce((sum, row) => sum + Number(row.lastBalance), 0);
  const liveStocks = stockRows.reduce((sum, row) => sum + Number(row.marketValue), 0);
  const liveCrypto = cryptoRows.reduce((sum, row) => sum + Number(row.marketValue), 0);
  const liveTotal = liveCash + liveStocks + liveCrypto;
  const cash = options?.snapshotOverride?.cash ?? liveCash;
  const stocks = options?.snapshotOverride?.stocks ?? liveStocks;
  const crypto = options?.snapshotOverride?.crypto ?? liveCrypto;
  const total = cash + stocks + crypto;
  if (!persistDailySnapshot) {
    return { cash, stocks, crypto, total };
  }

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

async function getFirstIntradaySummaryForNyDay(userId: string): Promise<SnapshotOverride | null> {
  const recent = await db
    .select({
      capturedAt: intradaySnapshots.capturedAt,
      cash: intradaySnapshots.cashTotal,
      stocks: intradaySnapshots.stocksTotal,
      crypto: intradaySnapshots.cryptoTotal,
      total: intradaySnapshots.totalNetWorth,
    })
    .from(intradaySnapshots)
    .where(eq(intradaySnapshots.userId, userId))
    .orderBy(asc(intradaySnapshots.capturedAt))
    .limit(600);

  const todayNy = getNyDateKey(new Date());
  const first = recent.find((row) => {
    if (!row.capturedAt) return false;
    return getNyDateKey(row.capturedAt) === todayNy && getNyHour(row.capturedAt) >= 9;
  });
  if (!first) return null;

  // Preserve morning market prices while still allowing newer bank cash to update later.
  return {
    stocks: Number(first.stocks),
    crypto: Number(first.crypto),
  };
}

async function persistIntradaySnapshot(userId: string, syncRunId: string, summary: SyncSummary) {
  await db.insert(intradaySnapshots).values({
    userId,
    syncRunId,
    cashTotal: toMoney(summary.cash),
    stocksTotal: toMoney(summary.stocks),
    cryptoTotal: toMoney(summary.crypto),
    totalNetWorth: toMoney(summary.total),
    capturedAt: new Date(),
  });
}

async function applyIntradayRetentionPolicy(userId: string) {
  // Keep high-resolution points for 30 days, then keep one point per hour for older data.
  await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY user_id, date_trunc('hour', captured_at)
          ORDER BY captured_at ASC
        ) AS rn
      FROM intraday_snapshots
      WHERE user_id = ${userId}
        AND captured_at < now() - interval '30 days'
    )
    DELETE FROM intraday_snapshots s
    USING ranked r
    WHERE s.id = r.id
      AND r.rn > 1;
  `);

  // Hard cap for old rolled-up data.
  await db.execute(sql`
    DELETE FROM intraday_snapshots
    WHERE user_id = ${userId}
      AND captured_at < now() - interval '365 days';
  `);
}

async function runPriceRefreshSteps(
  userId: string,
  pushEvent: (message: string, provider?: "plaid" | "snaptrade" | "coingecko") => Promise<void>,
) {
  await pushEvent("Using manual holdings for stocks and crypto", "snaptrade");
  try {
    await removeAutoStockHoldings(userId);
    await pushEvent("Fetching latest market prices for manual holdings", "coingecko");
    const result = await refreshManualHoldingValuations(userId);
    await pushEvent(
      `Updated prices for ${result.updatedStockCount}/${result.stockSymbols.length} stock symbols and ${result.updatedCryptoCount}/${result.cryptoSymbols.length} crypto symbols`,
      "coingecko",
    );
  } catch (error) {
    await pushEvent(
      `Manual holding valuation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "coingecko",
    );
  }
}

async function executeFullSync(
  syncRunId: string,
  userId: string,
  trigger: SyncTrigger,
): Promise<SyncRunResult> {
  const events: SyncEvent[] = [];
  let order = 1;
  let summary: SyncSummary | null = null;
  const adapters = getProviderAdapters();
  const adapterModes = getProviderAdapterModes();

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
      const plaidTimeoutMs =
        trigger === "scheduled" ? PLAID_FETCH_TIMEOUT_MS_SCHEDULED : PLAID_FETCH_TIMEOUT_MS;
      const plaidAttempts = trigger === "scheduled" ? 1 : PROVIDER_RETRY_COUNT;
      const plaid = await withRetry(
        () =>
          withTimeout(
            adapters.plaid.fetchBalances(userId),
            plaidTimeoutMs,
            "Plaid balance fetch timed out.",
          ),
        plaidAttempts,
        600,
      );
      await removeLegacyMockInstitutionAccounts(userId);
      const activePlaidIds = new Set(plaid.data.map((a) => a.providerAccountId));
      await upsertCashAccounts(userId, plaid.data);
      await markPlaidConnectionsSynced(
        userId,
        plaid.data.map((a) => a.plaidItemId ?? "").filter(Boolean),
      );
      if (adapterModes.plaid === "real") {
        const plaidConnections = await db.query.connections.findMany({
          where: and(eq(connections.userId, userId), eq(connections.provider, "plaid")),
        });
        for (const conn of plaidConnections) {
          const activeForItem = new Set(
            plaid.data
              .filter((a) => a.plaidItemId === conn.externalId)
              .map((a) => a.providerAccountId),
          );
          await prunePlaidAccountsNotInFetch(userId, conn.id, activeForItem);
        }
        await dedupeCashAccountsByDisplayKey(userId, activePlaidIds);
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

    await runPriceRefreshSteps(userId, pushEvent);

    await pushEvent("Calculating net worth");
    const persistDailySnapshot = trigger === "scheduled";
    const snapshotOverride = persistDailySnapshot
      ? await getFirstIntradaySummaryForNyDay(userId)
      : null;
    if (snapshotOverride) {
      await pushEvent("Using first intraday point as 9:00 AM ET baseline for daily snapshot");
    }
    summary = await persistSnapshot(userId, syncRunId, { persistDailySnapshot, snapshotOverride });
    if (summary && (trigger === "scheduled" || trigger === "system")) {
      await persistIntradaySnapshot(userId, syncRunId, summary);
      await applyIntradayRetentionPolicy(userId);
    }
    if (persistDailySnapshot) {
      await pushEvent("Saving snapshot");
    } else {
      await pushEvent("Skipping daily snapshot (only 9:00 AM scheduled snapshots are stored)");
    }

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

async function executePriceOnlySync(
  syncRunId: string,
  userId: string,
  trigger: SyncTrigger,
): Promise<SyncRunResult> {
  const events: SyncEvent[] = [];
  let order = 1;
  let summary: SyncSummary | null = null;

  const pushEvent = async (
    message: string,
    provider?: "plaid" | "snaptrade" | "coingecko",
  ) => {
    const event = await appendEvent(syncRunId, order, message, provider);
    order += 1;
    events.push(event);
  };

  await pushEvent("Starting price-only sync job");
  try {
    await runPriceRefreshSteps(userId, pushEvent);
    await pushEvent("Calculating net worth");
    const persistDailySnapshot = trigger === "scheduled";
    const snapshotOverride = persistDailySnapshot
      ? await getFirstIntradaySummaryForNyDay(userId)
      : null;
    if (snapshotOverride) {
      await pushEvent("Using first intraday point as 9:00 AM ET baseline for daily snapshot");
    }
    summary = await persistSnapshot(userId, syncRunId, { persistDailySnapshot, snapshotOverride });
    if (summary && (trigger === "scheduled" || trigger === "system")) {
      await persistIntradaySnapshot(userId, syncRunId, summary);
      await applyIntradayRetentionPolicy(userId);
    }
    if (persistDailySnapshot) {
      await pushEvent("Saving snapshot");
    } else {
      await pushEvent("Skipping daily snapshot (only 9:00 AM scheduled snapshots are stored)");
    }

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
    const ageMs = Date.now() - running.startedAt.getTime();
    if (ageMs > RUN_STALE_AFTER_MS) {
      await db
        .update(syncRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: `Auto-failed stale run after ${Math.round(ageMs / 60000)} minutes without completion.`,
        })
        .where(eq(syncRuns.id, running.id));
    } else {
      return {
        runId: running.id,
        status: running.status as SyncStatus,
        started: false,
        skipped: true,
        skipReason: "A sync run is already in progress.",
      };
    }
  }

  const runningAfterCleanup = await db.query.syncRuns.findFirst({
    where: and(eq(syncRuns.userId, userId), eq(syncRuns.status, "running")),
    orderBy: (table, { desc: descFn }) => [descFn(table.startedAt)],
  });

  if (runningAfterCleanup) {
    return {
      runId: runningAfterCleanup.id,
      status: runningAfterCleanup.status as SyncStatus,
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
      if (alreadyRanToday.status === "completed") {
        const cashRows = await db.query.accounts.findMany({
          where: and(eq(accounts.userId, userId), inArray(accounts.type, ["checking", "savings"])),
        });
        const latestCashAsOf = cashRows
          .map((row) => row.balanceAsOf)
          .filter((value): value is Date => value instanceof Date)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const hasFreshCashForNyDay = latestCashAsOf
          ? getNyDateKey(latestCashAsOf) === nyToday
          : false;

        // Recovery mode: allow another scheduled run later the same day if
        // cash balances are still stale for today (e.g., Plaid failed at 9 AM).
        if (!hasFreshCashForNyDay) {
          // continue and create a new scheduled run
        } else {
          return {
            runId: alreadyRanToday.id,
            status: alreadyRanToday.status as SyncStatus,
            started: false,
            skipped: true,
            skipReason: "Scheduled sync already ran for current America/New_York day.",
          };
        }
      } else {
        return {
          runId: alreadyRanToday.id,
          status: alreadyRanToday.status as SyncStatus,
          started: false,
          skipped: true,
          skipReason: "Scheduled sync already ran for current America/New_York day.",
        };
      }
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
    const promise = executeFullSync(run.runId, userId, trigger).then(() => undefined);
    inFlightRuns.set(run.runId, promise);
    await promise.finally(() => inFlightRuns.delete(run.runId));
  }
  return getSyncRunProgress(run.runId);
}

export async function triggerSyncInBackground(userId: string, trigger: SyncTrigger = "manual") {
  const run = await createSyncRun(userId, trigger);
  if (run.started) {
    const promise = executeFullSync(run.runId, userId, trigger).then(() => undefined);
    inFlightRuns.set(run.runId, promise);
    void promise.finally(() => inFlightRuns.delete(run.runId));
  }
  return run;
}

export async function triggerPriceOnlySyncInBackground(userId: string, trigger: SyncTrigger = "manual") {
  const run = await createSyncRun(userId, trigger);
  if (run.started) {
    const promise = executePriceOnlySync(run.runId, userId, trigger).then(() => undefined);
    inFlightRuns.set(run.runId, promise);
    void promise.finally(() => inFlightRuns.delete(run.runId));
  }
  return run;
}

export async function runPriceOnlySync(userId: string, trigger: SyncTrigger = "manual") {
  const run = await createSyncRun(userId, trigger);
  if (run.started) {
    const promise = executePriceOnlySync(run.runId, userId, trigger).then(() => undefined);
    inFlightRuns.set(run.runId, promise);
    await promise.finally(() => inFlightRuns.delete(run.runId));
  }
  return getSyncRunProgress(run.runId);
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
