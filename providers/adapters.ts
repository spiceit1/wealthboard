import { env } from "@/lib/env";
import { fetchCryptoPrices } from "@/providers/coingecko";
import { fetchCryptoPricesMock } from "@/providers/coingecko.mock";
import { fetchPlaidBalances } from "@/providers/plaid";
import { fetchPlaidBalancesMock } from "@/providers/plaid.mock";
import { fetchSnapTradePositions } from "@/providers/snaptrade";
import { fetchSnapTradePositionsMock } from "@/providers/snaptrade.mock";
import type { Position, ProviderResult, AccountBalance } from "@/providers/types";

export type CryptoPrice = {
  symbol: string;
  price: number;
};

export type ProviderAdapters = {
  plaid: {
    fetchBalances: (userId?: string) => Promise<ProviderResult<AccountBalance[]>>;
  };
  snaptrade: {
    fetchPositions: () => Promise<ProviderResult<Position[]>>;
  };
  coingecko: {
    fetchPrices: (symbols: string[]) => Promise<ProviderResult<CryptoPrice[]>>;
  };
};

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required when MOCK_MODE=false`);
  }
}

type AdapterMode = "mock" | "real";

export function getProviderAdapterModes(): Record<"plaid" | "snaptrade" | "coingecko", AdapterMode> {
  if (env.MOCK_MODE) {
    return {
      plaid: "mock",
      snaptrade: "mock",
      coingecko: "mock",
    };
  }

  const plaidConfigured = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  return {
    plaid: plaidConfigured ? "real" : "mock",
    // Real adapters for these providers are not implemented yet.
    snaptrade: "mock",
    coingecko: "mock",
  };
}

export function getProviderAdapters(): ProviderAdapters {
  const modes = getProviderAdapterModes();
  if (modes.plaid === "real") {
    requireEnv("PLAID_CLIENT_ID", process.env.PLAID_CLIENT_ID);
    requireEnv("PLAID_SECRET", process.env.PLAID_SECRET);
  }

  return {
    plaid: {
      fetchBalances:
        modes.plaid === "real"
          ? (userId?: string) => fetchPlaidBalances(userId)
          : () => fetchPlaidBalancesMock(),
    },
    snaptrade: {
      fetchPositions: modes.snaptrade === "real" ? fetchSnapTradePositions : fetchSnapTradePositionsMock,
    },
    coingecko: {
      fetchPrices: modes.coingecko === "real" ? fetchCryptoPrices : fetchCryptoPricesMock,
    },
  };
}
