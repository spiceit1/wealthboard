export type StockQuote = { price: number; pricedAt: Date };

export function parseStockQuote(payload: unknown, now = Date.now()): StockQuote {
  const meta = (payload as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const timestamp = meta?.regularMarketTime;
  if (meta?.currency !== "USD" || typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
      typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new Error("Quote response has no valid USD price or market timestamp");
  }
  const pricedAt = new Date(timestamp * 1000);
  // Allow weekends and holidays, but never present an old quote as a new refresh.
  if (pricedAt.getTime() > now + 300_000 || now - pricedAt.getTime() > 7 * 86400_000) {
    throw new Error("Quote timestamp is stale or invalid");
  }
  return { price, pricedAt };
}

export async function fetchStockQuote(symbol: string, request: typeof fetch = fetch): Promise<StockQuote> {
  const ticker = symbol.trim().toUpperCase().replace(/\./g, "-");
  let reason = "Quote unavailable";
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const response = await request(`https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`, {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error(`Quote provider returned HTTP ${response.status}`);
      return parseStockQuote(await response.json());
    } catch (error) {
      reason = error instanceof Error ? error.message : "Quote request failed";
    }
  }
  throw new Error(`${symbol}: ${reason}`);
}

export async function fetchStockPrices(symbols: string[], request: typeof fetch = fetch) {
  const quotes = new Map<string, StockQuote>();
  const failures: string[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(8, symbols.length) }, async () => {
    while (cursor < symbols.length) {
      const symbol = symbols[cursor++];
      try { quotes.set(symbol.toUpperCase(), await fetchStockQuote(symbol, request)); }
      catch (error) { failures.push(error instanceof Error ? error.message : `${symbol}: quote unavailable`); }
    }
  }));
  return { quotes, failures };
}
