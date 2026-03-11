import type { ProviderResult } from "@/providers/types";

import type { CryptoPrice } from "@/providers/coingecko";

const mockPrices: Record<string, number> = {
  BTC: 68452.11,
  ETH: 3521.87,
  SOL: 139.52,
};

export async function fetchCryptoPricesMock(
  symbols: string[],
): Promise<ProviderResult<CryptoPrice[]>> {
  const normalized = symbols.map((symbol) => symbol.toUpperCase());

  return {
    source: "coingecko",
    fetchedAt: new Date().toISOString(),
    data: normalized.map((symbol) => ({
      symbol,
      price: mockPrices[symbol] ?? 1,
    })),
  };
}
