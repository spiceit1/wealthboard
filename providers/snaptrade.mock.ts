import type { Position, ProviderResult } from "@/providers/types";

export async function fetchSnapTradePositionsMock(): Promise<ProviderResult<Position[]>> {
  return {
    source: "snaptrade",
    fetchedAt: new Date().toISOString(),
    data: [
      {
        symbol: "VOO",
        quantity: 120.5,
        price: 501.34,
        value: 60411.47,
        assetClass: "stock",
      },
      {
        symbol: "AAPL",
        quantity: 225,
        price: 210.11,
        value: 47274.75,
        assetClass: "stock",
      },
    ],
  };
}
