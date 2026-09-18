// A complete, directly verified account snapshot takes precedence until Plaid agrees.
export const VERIFIED_PREFIX = 'robinhood-verified:';
type Position = {symbol:string;assetClass:string;quantity:number};
export function matchesVerifiedPositions(verified: Position[], incoming: Position[]) {
  const totals = (rows:Position[]) => {
    const result = new Map<string,number>();
    for (const p of rows) {
      if (!Number.isFinite(p.quantity) || p.quantity < 0) return null;
      const key = `${p.assetClass}:${p.symbol}`;
      result.set(key,(result.get(key) ?? 0)+p.quantity);
    }
    return result;
  };
  const a=totals(verified), b=totals(incoming);
  // Missing cash is unknown, not zero. Require a complete match, ignoring prices.
  if (!a || !b || !a.has('cash:USD') || !b.has('cash:USD') || a.size!==b.size) return false;
  return [...a].every(([key,value]) => b.has(key) && Math.abs(value-b.get(key)!) <= (key==='cash:USD' ? 0.005 : 0.00000001));
}
