import type { CardCharge } from './credit-card';

export const transactionOrder = (a: CardCharge, b: CardCharge) =>
  b.date.localeCompare(a.date) || a.id.localeCompare(b.id);

/** Reconstruct backwards from current posted balance before any display filters. */
export function bankRunningBalances(transactions: CardCharge[], balance: number | null, currency: string) {
  const result = new Map<string, number>();
  if (balance === null || !Number.isFinite(balance)) return result;
  let cents = Math.round(balance * 100);
  for (const transaction of [...transactions].sort(transactionOrder)) {
    if (transaction.pending || transaction.currency !== currency) continue;
    result.set(transaction.id, cents / 100);
    cents += Math.round(transaction.amount * 100);
  }
  return result;
}
