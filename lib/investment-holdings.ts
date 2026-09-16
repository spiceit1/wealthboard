import type { InvestmentsHoldingsGetResponse } from 'plaid';

export type InvestmentSnapshot = ReturnType<typeof normalizeInvestmentHoldings>;
export function normalizeInvestmentHoldings(response: InvestmentsHoldingsGetResponse) {
  const accounts = response.accounts.filter(a => a.type === 'investment');
  if (!accounts.length) throw new Error('No investment accounts were shared. Reconnect and select your brokerage account.');
  const accountIds = new Set(accounts.map(a => a.account_id));
  const securities = new Map(response.securities.map(s => [s.security_id, s]));
  const seen = new Set<string>();
  const positions = response.holdings.filter(h => accountIds.has(h.account_id)).flatMap(h => {
    const security = securities.get(h.security_id);
    if (!security) throw new Error('Plaid returned a holding without security details. Previous holdings retained.');
    // Brokerage cash is not a stock position and must not be imported as one.
    if (security.is_cash_equivalent || security.type === 'cash' || security.type === 'cryptocurrency') return [];
    if (!['equity', 'etf', 'mutual fund'].includes(security.type ?? '')) {
      throw new Error(`Cannot yet import ${security.name ?? h.security_id} (${security.type ?? 'unknown type'}). Previous holdings retained.`);
    }
    const symbol = security.ticker_symbol?.trim().toUpperCase();
    if (!symbol || symbol.length > 20) throw new Error('A holding has no supported ticker symbol. Previous holdings retained.');
    if ((h.iso_currency_code ?? security.iso_currency_code) !== 'USD') throw new Error(`Cannot import non-USD holding ${symbol}.`);
    if (![h.quantity, h.institution_price, h.institution_value].every(Number.isFinite) || h.quantity < 0 || h.institution_price < 0 || h.institution_value < 0) {
      throw new Error(`Invalid or short position for ${symbol}. Previous holdings retained.`);
    }
    const key = `${h.account_id}:${h.security_id}`;
    if (seen.has(key)) throw new Error('Plaid returned duplicate positions. Previous holdings retained.');
    seen.add(key);
    if (h.quantity === 0) return [];
    const quoteDate = h.institution_price_datetime ?? (h.institution_price_as_of ? `${h.institution_price_as_of}T00:00:00Z` : null);
    return [{ accountId: h.account_id, securityId: h.security_id, symbol,
      name: (security.name || symbol).slice(0, 120), assetClass: 'stock' as const,
      quantity: h.quantity, price: h.institution_price, value: h.institution_value,
      pricedAt: quoteDate && Number.isFinite(Date.parse(quoteDate)) ? new Date(quoteDate).toISOString() : null }];
  });
  return { accounts: accounts.map(a => ({ accountId: a.account_id, name: a.name.slice(0,120) })), positions };
}
