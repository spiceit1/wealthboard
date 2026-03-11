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
    fetchBalances: () => Promise<ProviderResult<AccountBalance[]>>;
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

export function getProviderAdapters(): ProviderAdapters {
  if (env.MOCK_MODE) {
    return {
      plaid: {
        fetchBalances: fetchPlaidBalancesMock,
      },
      snaptrade: {
        fetchPositions: fetchSnapTradePositionsMock,
      },
      coingecko: {
        fetchPrices: fetchCryptoPricesMock,
      },
    };
  }

  requireEnv("PLAID_CLIENT_ID", process.env.PLAID_CLIENT_ID);
  requireEnv("PLAID_SECRET", process.env.PLAID_SECRET);
  requireEnv("SNAPTRADE_CLIENT_ID", process.env.SNAPTRADE_CLIENT_ID);
  requireEnv("SNAPTRADE_CONSUMER_KEY", process.env.SNAPTRADE_CONSUMER_KEY);

  return {
    plaid: {
      fetchBalances: fetchPlaidBalances,
    },
    snaptrade: {
      fetchPositions: fetchSnapTradePositions,
    },
    coingecko: {
      fetchPrices: fetchCryptoPrices,
    },
  };
}
