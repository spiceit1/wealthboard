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

  const normalized = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("symbols", normalized.join(","));
  url.searchParams.set("per_page", String(Math.max(normalized.length, 10)));
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");

  const headers: Record<string, string> = {};
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-pro-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`CoinGecko request failed (${response.status}).`);
  }

  type CoinGeckoMarketRow = {
    symbol: string;
    current_price: number;
  };
  const payload = (await response.json()) as CoinGeckoMarketRow[];
  const priceBySymbol = new Map<string, number>();
  for (const row of payload) {
    if (!row.symbol || typeof row.current_price !== "number") continue;
    priceBySymbol.set(row.symbol.toUpperCase(), row.current_price);
  }

  return {
    source: "coingecko",
    fetchedAt: new Date().toISOString(),
    data: normalized
      .filter((symbol) => priceBySymbol.has(symbol))
      .map((symbol) => ({
        symbol,
        price: priceBySymbol.get(symbol) ?? 0,
      })),
  };
}
