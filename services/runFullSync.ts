import { env } from "@/lib/env";
import { fetchCryptoPrices } from "@/providers/coingecko";
import { fetchCryptoPricesMock } from "@/providers/coingecko.mock";
import { fetchPlaidBalances } from "@/providers/plaid";
import { fetchPlaidBalancesMock } from "@/providers/plaid.mock";
import { fetchSnapTradePositions } from "@/providers/snaptrade";
import { fetchSnapTradePositionsMock } from "@/providers/snaptrade.mock";

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
  status: "completed" | "failed";
  events: SyncEvent[];
  summary: SyncSummary;
};

export async function runFullSync(): Promise<SyncRunResult> {
  const events: SyncEvent[] = [];
  const now = () => new Date().toISOString();
  events.push({ timestamp: now(), message: "Starting sync job" });

  const plaid = env.MOCK_MODE ? await fetchPlaidBalancesMock() : await fetchPlaidBalances();
  events.push({ timestamp: now(), message: "Fetched Plaid bank balances" });

  const broker = env.MOCK_MODE
    ? await fetchSnapTradePositionsMock()
    : await fetchSnapTradePositions();
  events.push({ timestamp: now(), message: "Fetched Robinhood portfolio" });

  const cryptoSymbols = ["BTC", "ETH"];
  const cryptoPrices = env.MOCK_MODE
    ? await fetchCryptoPricesMock(cryptoSymbols)
    : await fetchCryptoPrices(cryptoSymbols);
  events.push({ timestamp: now(), message: "Fetched crypto prices" });

  const cash = plaid.data.reduce((sum, account) => sum + account.balance, 0);
  const stocks = broker.data
    .filter((position) => position.assetClass === "stock")
    .reduce((sum, position) => sum + position.value, 0);
  const crypto = cryptoPrices.data.reduce((sum, price) => {
    const quantity = price.symbol === "BTC" ? 0.18 : price.symbol === "ETH" ? 2.4 : 0;
    return sum + price.price * quantity;
  }, 0);

  const summary = { cash, stocks, crypto, total: cash + stocks + crypto };

  events.push({ timestamp: now(), message: "Sync complete" });

  return {
    status: "completed",
    events,
    summary,
  };
}
