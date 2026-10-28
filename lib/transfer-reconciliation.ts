export type TransitInterval = { from: string; until: string | null };
export type TransferRecord = {
  id: string; amount: string; sourceAccountId: string; destinationAccountId: string;
  sourceLabel: string; destinationLabel: string; status: string;
  destinationBalance: string; transactionId: string | null; transferDate: string;
  intervals: TransitInterval[]; evidence: string; updatedAt: Date;
};
export const cents = (n: number | string) => Math.round(Number(n) * 100);
export function transitAt(rows: Pick<TransferRecord, 'amount' | 'intervals'>[], at: Date) {
  return rows.reduce((sum, r) => sum + (r.intervals.some(i => Date.parse(i.from) <= at.getTime() && (!i.until || at.getTime() < Date.parse(i.until))) ? cents(r.amount) : 0), 0) / 100;
}
export function closeTransit(intervals: TransitInterval[], at: Date) {
  return intervals.map(i => i.until ? i : {...i, until: new Date(Math.max(Date.parse(i.from), at.getTime())).toISOString()});
}
// A balance movement alone never proves a deposit posted. Suspend counting instead.
export function transferState(row: TransferRecord, balance: string, posted: boolean, now: Date) {
  if (row.status !== 'in_transit') return row;
  if (posted || cents(balance) !== cents(row.destinationBalance) || now.getTime() - Date.parse(row.intervals.at(-1)!.from) > 7 * 86400000) {
    return {...row, status: posted ? 'received' : 'needs_review', intervals: closeTransit(row.intervals, now)};
  }
  return row;
}
export function unambiguousCashDrop(previous: number, current: number, pending: number, alreadyTracked: number) {
  return pending > 0 && cents(previous - current) === cents(pending) && cents(alreadyTracked) === 0;
}
