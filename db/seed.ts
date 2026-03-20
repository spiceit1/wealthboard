import { config } from "dotenv";
import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  accounts,
  connections,
  dailySnapshots,
  holdings,
  prices,
  providerTokens,
  snapshotItems,
  syncRunEvents,
  syncRuns,
  users,
} from "@/db/schema";

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function jitter(seed: number, magnitude: number) {
  return Math.sin(seed) * magnitude + Math.cos(seed * 0.61) * magnitude * 0.4;
}

const localEnv = config({ path: ".env.local" });
if (localEnv.parsed) {
  Object.assign(process.env, localEnv.parsed);
}
config();

async function seed() {
  await db.execute(sql`
    TRUNCATE TABLE
      snapshot_items,
      daily_snapshots,
      sync_run_events,
      sync_runs,
      prices,
      holdings,
      accounts,
      plaid_items,
      provider_tokens,
      connections,
      users
    RESTART IDENTITY CASCADE;
  `);

  const [user] = await db
    .insert(users)
    .values({
      email: "demo@wealthboard.local",
      fullName: "WealthBoard Demo User",
    })
    .returning();

  const [plaidConnection, snaptradeConnection, cryptoConnection] = await db
    .insert(connections)
    .values([
      {
        userId: user.id,
        provider: "plaid",
        externalId: "plaid-user-demo",
        displayName: "Plaid - Demo Institutions",
      },
      {
        userId: user.id,
        provider: "snaptrade",
        externalId: "snaptrade-user-demo",
        displayName: "SnapTrade - Robinhood",
      },
      {
        userId: user.id,
        provider: "coingecko",
        externalId: "coingecko-user-demo",
        displayName: "CoinGecko - Manual Crypto",
      },
    ])
    .returning();

  await db.insert(providerTokens).values([
    {
      userId: user.id,
      provider: "snaptrade",
      accessTokenEncrypted: "mock-encrypted-snaptrade-token",
      scopes: ["accounts:read", "positions:read"],
    },
    {
      userId: user.id,
      provider: "coingecko",
      accessTokenEncrypted: "mock-encrypted-coingecko-key",
      scopes: ["prices:read"],
    },
  ]);

  const [robinhoodBrokerage, btcWallet, ethWallet] = await db
    .insert(accounts)
    .values([
      {
        userId: user.id,
        connectionId: snaptradeConnection.id,
        providerAccountId: "robinhood-brokerage-001",
        institutionName: "Robinhood",
        name: "Robinhood Brokerage",
        type: "brokerage",
        lastBalance: "482211.00",
      },
      {
        userId: user.id,
        connectionId: cryptoConnection.id,
        providerAccountId: "wallet-btc-001",
        institutionName: "Manual",
        name: "BTC",
        type: "crypto_wallet",
        lastBalance: "12300.00",
      },
      {
        userId: user.id,
        connectionId: cryptoConnection.id,
        providerAccountId: "wallet-eth-001",
        institutionName: "Manual",
        name: "ETH",
        type: "crypto_wallet",
        lastBalance: "2200.00",
      },
    ])
    .returning();

  const [vooHolding, aaplHolding, btcHolding, ethHolding] = await db
    .insert(holdings)
    .values([
      {
        userId: user.id,
        accountId: robinhoodBrokerage.id,
        symbol: "VOO",
        name: "Vanguard S&P 500 ETF",
        assetClass: "stock",
        quantity: "510.25000000",
        lastPrice: "502.350000",
        marketValue: "256823.96",
      },
      {
        userId: user.id,
        accountId: robinhoodBrokerage.id,
        symbol: "AAPL",
        name: "Apple Inc.",
        assetClass: "stock",
        quantity: "1060.00000000",
        lastPrice: "212.630000",
        marketValue: "225387.80",
      },
      {
        userId: user.id,
        accountId: btcWallet.id,
        symbol: "BTC",
        name: "Bitcoin",
        assetClass: "crypto",
        quantity: "0.18000000",
        lastPrice: "68333.330000",
        marketValue: "12299.99",
        isManual: true,
      },
      {
        userId: user.id,
        accountId: ethWallet.id,
        symbol: "ETH",
        name: "Ethereum",
        assetClass: "crypto",
        quantity: "2.40000000",
        lastPrice: "916.670000",
        marketValue: "2200.01",
        isManual: true,
      },
    ])
    .returning();

  await db.insert(prices).values([
    {
      symbol: "VOO",
      assetClass: "stock",
      price: "502.350000",
      pricedAt: new Date(),
      source: "snaptrade",
    },
    {
      symbol: "AAPL",
      assetClass: "stock",
      price: "212.630000",
      pricedAt: new Date(),
      source: "snaptrade",
    },
    {
      symbol: "BTC",
      assetClass: "crypto",
      price: "68333.330000",
      pricedAt: new Date(),
      source: "coingecko",
    },
    {
      symbol: "ETH",
      assetClass: "crypto",
      price: "916.670000",
      pricedAt: new Date(),
      source: "coingecko",
    },
  ]);

  const [syncRun] = await db
    .insert(syncRuns)
    .values({
      userId: user.id,
      status: "completed",
      trigger: "manual",
      isMock: true,
      startedAt: new Date(Date.now() - 45_000),
      completedAt: new Date(),
    })
    .returning();

  await db.insert(syncRunEvents).values([
    {
      syncRunId: syncRun.id,
      provider: "plaid",
      message: "Starting sync job",
      level: "info",
      eventOrder: 1,
    },
    {
      syncRunId: syncRun.id,
      provider: "plaid",
      message: "Fetching Plaid bank balances",
      level: "info",
      eventOrder: 2,
    },
    {
      syncRunId: syncRun.id,
      provider: "plaid",
      message: "Plaid: no seeded cash accounts (connect Link for real banks)",
      level: "info",
      eventOrder: 3,
    },
    {
      syncRunId: syncRun.id,
      provider: "snaptrade",
      message: "Fetching Robinhood portfolio",
      level: "info",
      eventOrder: 4,
    },
    {
      syncRunId: syncRun.id,
      provider: "snaptrade",
      message: "Retrieved 12 positions",
      level: "info",
      eventOrder: 5,
    },
    {
      syncRunId: syncRun.id,
      provider: "coingecko",
      message: "Fetching crypto prices",
      level: "info",
      eventOrder: 6,
    },
    {
      syncRunId: syncRun.id,
      provider: "coingecko",
      message: "Calculating net worth",
      level: "info",
      eventOrder: 7,
    },
    {
      syncRunId: syncRun.id,
      provider: "coingecko",
      message: "Saving snapshot",
      level: "info",
      eventOrder: 8,
    },
    {
      syncRunId: syncRun.id,
      provider: "coingecko",
      message: "Sync complete",
      level: "info",
      eventOrder: 9,
    },
  ]);

  const today = new Date();
  let prevTotal: number | null = null;
  let lastSnapshotId = "";

  for (let i = 89; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);

    const cash = 0;
    const baseStocks = 482_211 + jitter(i * 1.23, 4800);
    const baseCrypto = 14_500 + jitter(i * 0.83, 1200);

    const stocks = round2(baseStocks);
    const crypto = round2(Math.max(3000, baseCrypto));
    const total = round2(cash + stocks + crypto);
    const dailyChange = prevTotal === null ? 0 : round2(total - prevTotal);
    prevTotal = total;

    const [snapshot] = await db
      .insert(dailySnapshots)
      .values({
        userId: user.id,
        snapshotDate: toDateKey(day),
        cashTotal: cash.toFixed(2),
        stocksTotal: stocks.toFixed(2),
        cryptoTotal: crypto.toFixed(2),
        totalNetWorth: total.toFixed(2),
        dailyChange: dailyChange.toFixed(2),
        syncRunId: syncRun.id,
      })
      .returning();

    lastSnapshotId = snapshot.id;
  }

  await db.insert(snapshotItems).values([
    {
      snapshotId: lastSnapshotId,
      category: "brokerage_position",
      accountId: robinhoodBrokerage.id,
      holdingId: vooHolding.id,
      label: "Vanguard S&P 500 ETF",
      symbol: "VOO",
      quantity: "510.25000000",
      price: "502.350000",
      value: "256823.96",
      meta: { account: "Robinhood Brokerage" },
    },
    {
      snapshotId: lastSnapshotId,
      category: "brokerage_position",
      accountId: robinhoodBrokerage.id,
      holdingId: aaplHolding.id,
      label: "Apple Inc.",
      symbol: "AAPL",
      quantity: "1060.00000000",
      price: "212.630000",
      value: "225387.80",
      meta: { account: "Robinhood Brokerage" },
    },
    {
      snapshotId: lastSnapshotId,
      category: "crypto_holding",
      accountId: btcWallet.id,
      holdingId: btcHolding.id,
      label: "Bitcoin",
      symbol: "BTC",
      quantity: "0.18000000",
      price: "68333.330000",
      value: "12299.99",
      meta: { source: "manual" },
    },
    {
      snapshotId: lastSnapshotId,
      category: "crypto_holding",
      accountId: ethWallet.id,
      holdingId: ethHolding.id,
      label: "Ethereum",
      symbol: "ETH",
      quantity: "2.40000000",
      price: "916.670000",
      value: "2200.01",
      meta: { source: "manual" },
    },
  ]);

  console.log("Seed complete with demo financial data.");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
