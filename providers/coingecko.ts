import type { ProviderResult } from "@/providers/types";

export type CryptoPrice = {
  symbol: string;
  price: number;
};

export async function fetchCryptoPrices(
  symbols: string[],
): Promise<ProviderResult<CryptoPrice[]>> {
  if (!symbols.length) {
    return {
      source: "coingecko",
      fetchedAt: new Date().toISOString(),
      data: [],
    };
  }

  throw new Error(
    "CoinGecko provider is not implemented yet. Use MOCK_MODE=true for local development.",
  );
}
