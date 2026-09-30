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

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch {
    // Do not persist request headers, credentials, or arbitrary upstream bodies.
    throw new Error("CoinGecko network request failed before an HTTP response was received.");
  }
  if (!response.ok) {
    const reason = response.status === 429 ? "rate limit reached"
      : response.status === 401 || response.status === 403 ? "API access rejected"
      : response.status >= 500 ? "provider service error" : "request rejected";
    throw new Error(`CoinGecko HTTP ${response.status}: ${reason}.`);
  }

  type CoinGeckoMarketRow = {
    symbol: string;
    current_price: number;
  };
  let payload: CoinGeckoMarketRow[];
  try {
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid payload");
    payload = data;
  } catch {
    throw new Error("CoinGecko returned an invalid price response.");
  }
  const priceBySymbol = new Map<string, number>();
  for (const row of payload) {
    if (!row || typeof row.symbol !== "string" || !Number.isFinite(row.current_price) || row.current_price <= 0) continue;
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
