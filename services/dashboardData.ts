import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  accounts,
  connections,
  dailySnapshots,
  holdings,
  intradaySnapshots,
  snapshotItems,
  syncRunEvents,
  syncRuns,
  users,
} from "@/db/schema";

function toNumber(value: string) {
  return Number(value);
}

function latestIso(values: Array<Date | null | undefined>) {
  const filtered = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime())
    .filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  return new Date(Math.max(...filtered)).toISOString();
}

function getNyDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function getNyHourMinute(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hour, minute };
}

function toNyTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export async function getDemoUserId() {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, "demo@wealthboard.local"),
    });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function getDashboardData(userId: string) {
  try {
    const [cashAccounts, stockHoldings, cryptoHoldings] = await Promise.all([
      db.query.accounts.findMany({
        where: and(eq(accounts.userId, userId), inArray(accounts.type, ["checking", "savings"])),
      }),
      db.query.holdings.findMany({
        where: and(eq(holdings.userId, userId), eq(holdings.assetClass, "stock")),
      }),
      db.query.holdings.findMany({
        where: and(eq(holdings.userId, userId), eq(holdings.assetClass, "crypto")),
      }),
    ]);

    const snapshots = await db
      .select({
        id: dailySnapshots.id,
        date: dailySnapshots.snapshotDate,
        cash: dailySnapshots.cashTotal,
        stocks: dailySnapshots.stocksTotal,
        crypto: dailySnapshots.cryptoTotal,
        total: dailySnapshots.totalNetWorth,
        dailyChange: dailySnapshots.dailyChange,
        createdAt: dailySnapshots.createdAt,
      })
      .from(dailySnapshots)
      .innerJoin(syncRuns, eq(dailySnapshots.syncRunId, syncRuns.id))
      .where(and(eq(dailySnapshots.userId, userId), eq(syncRuns.trigger, "scheduled")))
      .orderBy(desc(dailySnapshots.snapshotDate))
      .limit(90);

    const intradayRaw = await db
      .select({
        id: intradaySnapshots.id,
        capturedAt: intradaySnapshots.capturedAt,
        cash: intradaySnapshots.cashTotal,
        stocks: intradaySnapshots.stocksTotal,
        crypto: intradaySnapshots.cryptoTotal,
        total: intradaySnapshots.totalNetWorth,
      })
      .from(intradaySnapshots)
      .where(eq(intradaySnapshots.userId, userId))
      .orderBy(desc(intradaySnapshots.capturedAt))
      .limit(300);

    const liveCashTotal = cashAccounts.reduce((sum, row) => sum + Number(row.lastBalance), 0);
    const liveStocksTotal = stockHoldings.reduce((sum, row) => sum + Number(row.marketValue), 0);
    const liveCryptoTotal = cryptoHoldings.reduce((sum, row) => sum + Number(row.marketValue), 0);
    const liveTotal = liveCashTotal + liveStocksTotal + liveCryptoTotal;

    const latestSnapshot = snapshots[0] ?? null;
    const sortedHistory = [...snapshots].reverse();
    const todayNy = getNyDateKey(new Date());
    const intradayToday = [...intradayRaw]
      .reverse()
      .filter((row) => {
        if (!row.capturedAt) return false;
        const dateKey = getNyDateKey(row.capturedAt);
        if (dateKey !== todayNy) return false;
        const { hour } = getNyHourMinute(row.capturedAt);
        return hour >= 9;
      });
    const cashAsOf = latestIso(cashAccounts.map((row) => row.balanceAsOf));
    const stocksAsOf = latestIso(stockHoldings.map((row) => row.updatedAt));
    const cryptoAsOf = latestIso(cryptoHoldings.map((row) => row.updatedAt));
    const summaryAsOf = latestIso([
      cashAsOf ? new Date(cashAsOf) : null,
      stocksAsOf ? new Date(stocksAsOf) : null,
      cryptoAsOf ? new Date(cryptoAsOf) : null,
      latestSnapshot?.createdAt ?? null,
    ]);

    const shouldAppendLiveIntradayPoint =
      summaryAsOf != null &&
      (() => {
        const asOfDate = new Date(summaryAsOf);
        if (!Number.isFinite(asOfDate.getTime())) return false;
        if (getNyDateKey(asOfDate) !== todayNy) return false;
        const { hour } = getNyHourMinute(asOfDate);
        if (hour < 9) return false;
        const latestIntraday = intradayToday[intradayToday.length - 1];
        if (!latestIntraday?.capturedAt) return true;
        return asOfDate.getTime() - latestIntraday.capturedAt.getTime() > 60_000;
      })();

    const intradayRowsForChart = shouldAppendLiveIntradayPoint
      ? [
          ...intradayToday,
          {
            id: "live",
            capturedAt: summaryAsOf ? new Date(summaryAsOf) : new Date(),
            cash: liveCashTotal.toFixed(2),
            stocks: liveStocksTotal.toFixed(2),
            crypto: liveCryptoTotal.toFixed(2),
            total: liveTotal.toFixed(2),
          },
        ]
      : intradayToday;

    const intradayHistory = intradayRowsForChart.map((row, index) => {
      const total = toNumber(row.total);
      const previousTotal = index > 0 ? toNumber(intradayRowsForChart[index - 1].total) : total;
      return {
        id: row.id,
        date: toNyTimeLabel(row.capturedAt),
        capturedAt: row.capturedAt?.toISOString() ?? null,
        cash: toNumber(row.cash),
        stocks: toNumber(row.stocks),
        crypto: toNumber(row.crypto),
        total,
        dailyChange: total - previousTotal,
      };
    });
    const firstIntradayPoint = intradayRowsForChart[0];
    const firstIntradayTotal = firstIntradayPoint ? toNumber(firstIntradayPoint.total) : null;
    const firstIntradayCash = firstIntradayPoint ? toNumber(firstIntradayPoint.cash) : null;
    const firstIntradayStocks = firstIntradayPoint ? toNumber(firstIntradayPoint.stocks) : null;
    const firstIntradayCrypto = firstIntradayPoint ? toNumber(firstIntradayPoint.crypto) : null;
    const previousScheduledTotal = snapshots[1] ? toNumber(snapshots[1].total) : null;
    const previousScheduledCash = snapshots[1] ? toNumber(snapshots[1].cash) : null;
    const previousScheduledStocks = snapshots[1] ? toNumber(snapshots[1].stocks) : null;
    const previousScheduledCrypto = snapshots[1] ? toNumber(snapshots[1].crypto) : null;
    const baselineForDailyChange =
      firstIntradayTotal ?? previousScheduledTotal ?? (latestSnapshot ? toNumber(latestSnapshot.total) : liveTotal);
    const baselineCash =
      firstIntradayCash ?? previousScheduledCash ?? (latestSnapshot ? toNumber(latestSnapshot.cash) : liveCashTotal);
    const baselineStocks =
      firstIntradayStocks ??
      previousScheduledStocks ??
      (latestSnapshot ? toNumber(latestSnapshot.stocks) : liveStocksTotal);
    const baselineCrypto =
      firstIntradayCrypto ??
      previousScheduledCrypto ??
      (latestSnapshot ? toNumber(latestSnapshot.crypto) : liveCryptoTotal);
    const changeSinceLabel = firstIntradayPoint?.capturedAt
      ? `since ${toNyTimeLabel(firstIntradayPoint.capturedAt)} ET`
      : snapshots[1]
        ? `since ${snapshots[1].date} snapshot`
        : "since latest snapshot";
    const changeSinceAt = firstIntradayPoint?.capturedAt?.toISOString() ?? null;

    const latestRun = await db
      .select({
        id: syncRuns.id,
        status: syncRuns.status,
        startedAt: syncRuns.startedAt,
        completedAt: syncRuns.completedAt,
      })
      .from(syncRuns)
      .where(eq(syncRuns.userId, userId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    const [latestIntradayRun] = await db
      .select({
        startedAt: syncRuns.startedAt,
        completedAt: syncRuns.completedAt,
        status: syncRuns.status,
      })
      .from(syncRuns)
      .where(
        and(
          eq(syncRuns.userId, userId),
          inArray(syncRuns.trigger, ["system", "scheduled"]),
          eq(syncRuns.status, "completed"),
        ),
      )
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    const events = latestRun[0]
      ? await db
          .select({
            message: syncRunEvents.message,
            timestamp: syncRunEvents.createdAt,
            level: syncRunEvents.level,
          })
          .from(syncRunEvents)
          .where(eq(syncRunEvents.syncRunId, latestRun[0].id))
          .orderBy(asc(syncRunEvents.eventOrder))
      : [];

    return {
      summary: latestSnapshot
        ? {
            date: latestSnapshot.date,
            cash: liveCashTotal,
            stocks: liveStocksTotal,
            crypto: liveCryptoTotal,
            total: liveTotal,
            dailyChange: liveTotal - baselineForDailyChange,
            cashDailyChange: liveCashTotal - baselineCash,
            stocksDailyChange: liveStocksTotal - baselineStocks,
            cryptoDailyChange: liveCryptoTotal - baselineCrypto,
            changeSinceLabel,
            changeSinceAt,
            asOf: summaryAsOf,
            cashAsOf,
            stocksAsOf,
            cryptoAsOf,
          }
        : null,
      history: sortedHistory.map((row) => ({
        id: row.id,
        date: row.date,
        cash: toNumber(row.cash),
        stocks: toNumber(row.stocks),
        crypto: toNumber(row.crypto),
        total: toNumber(row.total),
        dailyChange: toNumber(row.dailyChange),
      })),
      intradayHistory,
      latestIntradaySyncAt: latestIntradayRun?.completedAt?.toISOString() ?? null,
      latestSync: latestRun[0] ?? null,
      events: events.map((event) => ({
        message: event.message,
        timestamp: event.timestamp?.toISOString() ?? new Date().toISOString(),
        level: event.level,
      })),
    };
  } catch {
    return {
      summary: null,
      history: [],
      intradayHistory: [],
      latestIntradaySyncAt: null,
      latestSync: null,
      events: [],
    };
  }
}

export async function getHistoryRows(userId: string) {
  try {
    return await db
      .select({
        date: dailySnapshots.snapshotDate,
        cash: dailySnapshots.cashTotal,
        stocks: dailySnapshots.stocksTotal,
        crypto: dailySnapshots.cryptoTotal,
        total: dailySnapshots.totalNetWorth,
        dailyChange: dailySnapshots.dailyChange,
      })
      .from(dailySnapshots)
      .innerJoin(syncRuns, eq(dailySnapshots.syncRunId, syncRuns.id))
      .where(and(eq(dailySnapshots.userId, userId), eq(syncRuns.trigger, "scheduled")))
      .orderBy(desc(dailySnapshots.snapshotDate));
  } catch {
    return [];
  }
}

export async function getSnapshotDetail(userId: string, date: string) {
  try {
    const snapshot = await db.query.dailySnapshots.findFirst({
      where: and(eq(dailySnapshots.userId, userId), eq(dailySnapshots.snapshotDate, date)),
    });

    if (!snapshot) {
      return null;
    }

    const items = await db.query.snapshotItems.findMany({
      where: eq(snapshotItems.snapshotId, snapshot.id),
      orderBy: (table, { asc: orderAsc }) => [orderAsc(table.category), orderAsc(table.label)],
    });

    return {
      snapshot,
      items,
    };
  } catch {
    return null;
  }
}

export async function getTrendRows(userId: string, days: number) {
  const from = new Date();
  from.setDate(from.getDate() - days);

  return db
    .select({
      date: dailySnapshots.snapshotDate,
      total: dailySnapshots.totalNetWorth,
    })
    .from(dailySnapshots)
    .where(and(eq(dailySnapshots.userId, userId), gte(dailySnapshots.createdAt, from)))
    .orderBy(asc(dailySnapshots.snapshotDate));
}

export async function getSyncRuns(userId: string, options?: { limit?: number; offset?: number }) {
  try {
    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);
    const runs = await db
      .select({
        id: syncRuns.id,
        status: syncRuns.status,
        trigger: syncRuns.trigger,
        startedAt: syncRuns.startedAt,
        completedAt: syncRuns.completedAt,
        errorMessage: syncRuns.errorMessage,
      })
      .from(syncRuns)
      .where(eq(syncRuns.userId, userId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(syncRuns)
      .where(eq(syncRuns.userId, userId));
    const total = Number(countRow?.count ?? 0);

    const runIds = runs.map((run) => run.id);
    const events =
      runIds.length > 0
        ? await db
            .select({
              syncRunId: syncRunEvents.syncRunId,
              message: syncRunEvents.message,
              level: syncRunEvents.level,
              eventOrder: syncRunEvents.eventOrder,
              createdAt: syncRunEvents.createdAt,
            })
            .from(syncRunEvents)
            .where(inArray(syncRunEvents.syncRunId, runIds))
            .orderBy(asc(syncRunEvents.eventOrder))
        : [];

    const lastEventByRun = new Map<string, (typeof events)[number]>();
    for (const event of events) {
      lastEventByRun.set(event.syncRunId, event);
    }

    return {
      total,
      runs: runs.map((run) => ({
        ...run,
        lastEvent: lastEventByRun.get(run.id)?.message ?? null,
      })),
    };
  } catch {
    return {
      total: 0,
      runs: [],
    };
  }
}

export async function getAccountsOverview(userId: string) {
  try {
    const rows = await db
      .select({
        id: accounts.id,
        institutionName: accounts.institutionName,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        balance: accounts.lastBalance,
        balanceAsOf: accounts.balanceAsOf,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.type), asc(accounts.name));

    return rows.map((row) => ({
      ...row,
      balance: Number(row.balance),
    }));
  } catch {
    return [];
  }
}

export async function getHoldingsOverview(userId: string) {
  try {
    const rows = await db
      .select({
        id: holdings.id,
        symbol: holdings.symbol,
        name: holdings.name,
        assetClass: holdings.assetClass,
        quantity: holdings.quantity,
        lastPrice: holdings.lastPrice,
        marketValue: holdings.marketValue,
        isManual: holdings.isManual,
        updatedAt: holdings.updatedAt,
      })
      .from(holdings)
      .where(eq(holdings.userId, userId))
      .orderBy(asc(holdings.assetClass), asc(holdings.symbol));

    const normalizedRows = rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      lastPrice: Number(row.lastPrice),
      marketValue: Number(row.marketValue),
    }));

    const currentStocksTotal = normalizedRows
      .filter((row) => row.assetClass === "stock")
      .reduce((sum, row) => sum + row.marketValue, 0);
    const currentCryptoTotal = normalizedRows
      .filter((row) => row.assetClass === "crypto")
      .reduce((sum, row) => sum + row.marketValue, 0);

    const intradayRaw = await db
      .select({
        capturedAt: intradaySnapshots.capturedAt,
        stocks: intradaySnapshots.stocksTotal,
        crypto: intradaySnapshots.cryptoTotal,
      })
      .from(intradaySnapshots)
      .where(eq(intradaySnapshots.userId, userId))
      .orderBy(asc(intradaySnapshots.capturedAt))
      .limit(300);

    const todayNy = getNyDateKey(new Date());
    const firstTodayIntraday = intradayRaw.find((row) => {
      if (!row.capturedAt) return false;
      if (getNyDateKey(row.capturedAt) !== todayNy) return false;
      const { hour } = getNyHourMinute(row.capturedAt);
      return hour >= 9;
    });

    const stocksChangeSinceOpen = firstTodayIntraday
      ? currentStocksTotal - toNumber(firstTodayIntraday.stocks)
      : null;
    const cryptoChangeSinceOpen = firstTodayIntraday
      ? currentCryptoTotal - toNumber(firstTodayIntraday.crypto)
      : null;
    const changeSinceLabel = firstTodayIntraday?.capturedAt
      ? `since ${toNyTimeLabel(firstTodayIntraday.capturedAt)} ET`
      : null;

    const [latestCompletedSync] = await db
      .select({
        completedAt: syncRuns.completedAt,
      })
      .from(syncRuns)
      .where(
        and(
          eq(syncRuns.userId, userId),
          eq(syncRuns.status, "completed"),
          inArray(syncRuns.trigger, ["manual", "system", "scheduled"]),
        ),
      )
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    return {
      rows: normalizedRows,
      stocksChangeSinceOpen,
      cryptoChangeSinceOpen,
      changeSinceLabel,
      latestSyncAt: latestCompletedSync?.completedAt?.toISOString() ?? null,
    };
  } catch {
    return {
      rows: [],
      stocksChangeSinceOpen: null,
      cryptoChangeSinceOpen: null,
      changeSinceLabel: null,
      latestSyncAt: null,
    };
  }
}

export async function getConnectionsOverview(userId: string) {
  try {
    return await db
      .select({
        id: connections.id,
        provider: connections.provider,
        displayName: connections.displayName,
        status: connections.status,
        lastSyncedAt: connections.lastSyncedAt,
      })
      .from(connections)
      .where(eq(connections.userId, userId))
      .orderBy(asc(connections.provider));
  } catch {
    return [];
  }
}

export async function getSettingsOverview(userId: string) {
  try {
    const [latestScheduled] = await db
      .select({
        id: syncRuns.id,
        status: syncRuns.status,
        startedAt: syncRuns.startedAt,
        completedAt: syncRuns.completedAt,
        errorMessage: syncRuns.errorMessage,
      })
      .from(syncRuns)
      .where(and(eq(syncRuns.userId, userId), eq(syncRuns.trigger, "scheduled")))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    const [latestManual] = await db
      .select({
        id: syncRuns.id,
        status: syncRuns.status,
        startedAt: syncRuns.startedAt,
        completedAt: syncRuns.completedAt,
        errorMessage: syncRuns.errorMessage,
      })
      .from(syncRuns)
      .where(and(eq(syncRuns.userId, userId), eq(syncRuns.trigger, "manual")))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    const nextNyNine = (() => {
      const now = new Date();
      const nyNow = new Date(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now),
      );
      const next = new Date(nyNow);
      next.setHours(9, 0, 0, 0);
      if (nyNow >= next) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    })();

    return {
      latestScheduled: latestScheduled ?? null,
      latestManual: latestManual ?? null,
      nextExpectedNyNine: nextNyNine,
    };
  } catch {
    return {
      latestScheduled: null,
      latestManual: null,
      nextExpectedNyNine: null,
    };
  }
}
