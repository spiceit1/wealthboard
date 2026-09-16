import type { Transaction } from "plaid";

export type CardCharge = { id: string; date: string; merchant: string; category: string; amount: number; pending: boolean; excluded: boolean; currency: string };
export type LinkedCard = { itemId: string; accountId: string; name: string; mask: string | null; balance: number | null; currency: string; transactionsAllowed: boolean; lastUpdated: string | null };
export const categoryLabel = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
export function normalizeCharge(t: Transaction): CardCharge {
  const primary = t.personal_finance_category?.primary ?? "UNCATEGORIZED";
  const detailed = t.personal_finance_category?.detailed ?? "";
  // Payments and transfers settle/move money; they are not purchases or refunds.
  const excluded = primary.startsWith("TRANSFER_") || primary === "LOAN_PAYMENTS" || detailed.includes("CREDIT_CARD_PAYMENT");
  return { id: t.transaction_id, date: t.date, merchant: t.merchant_name || t.name, category: categoryLabel(primary), amount: t.amount, pending: t.pending, excluded, currency: t.iso_currency_code ?? t.unofficial_currency_code ?? "Unknown" };
}
export function monthBefore(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 7);
}
export function spendingSummary(charges: CardCharge[], month: string, today: string, currency = "USD") {
  const previous = monthBefore(month);
  const comparableDays = Math.min(Number(today.slice(8, 10)), new Date(Date.UTC(Number(previous.slice(0, 4)), Number(previous.slice(5, 7)), 0)).getUTCDate());
  const currentMonth = month === today.slice(0, 7);
  const eligible = charges.filter(t => !t.pending && !t.excluded && t.currency === currency);
  const selected = eligible.filter(t => t.date.startsWith(month) && t.date <= today);
  const prior = eligible.filter(t => t.date.startsWith(previous) && (!currentMonth || Number(t.date.slice(8, 10)) <= comparableDays));
  const cents = (rows: CardCharge[]) => rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
  const categories = [...new Set([...selected, ...prior].map(t => t.category))].map(category => ({ category, amount: cents(selected.filter(t => t.category === category)), previous: cents(prior.filter(t => t.category === category)) })).sort((a, b) => b.amount - a.amount);
  const total = cents(selected), previousTotal = cents(prior);
  return { total, previousTotal, change: total - previousTotal, percent: previousTotal > 0 ? (total - previousTotal) / previousTotal * 100 : null, categories,
    pending: cents(charges.filter(t => t.pending && !t.excluded && t.currency === currency && t.date.startsWith(month))),
    purchases: cents(selected.filter(t => t.amount > 0)), refunds: -cents(selected.filter(t => t.amount < 0)), currentMonth, comparableDays };
}

/** Re-read each page; refuse inconsistent pagination instead of presenting partial totals. */
export async function collectCardTransactions(fetchPage: (offset: number) => Promise<{ transactions: Transaction[]; total_transactions: number }>) {
  const rows: Transaction[] = [];
  let expected: number | undefined;
  for (let page = 0; page < 20; page++) {
    const data = await fetchPage(rows.length);
    if (expected !== undefined && data.total_transactions !== expected) throw new Error("Card history changed while loading. Please refresh to get a complete view.");
    expected = data.total_transactions;
    rows.push(...data.transactions);
    if (new Set(rows.map(t => t.transaction_id)).size !== rows.length) throw new Error("Card history changed while loading. Please refresh.");
    if (rows.length === expected) return rows;
    if (!data.transactions.length || rows.length > expected) break;
  }
  throw new Error("Unable to load the complete card history. Please try again; partial totals are not shown.");
}
