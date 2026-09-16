import assert from "node:assert/strict";
import type { Transaction } from "plaid";
import { normalizeCharge, spendingSummary, collectCardTransactions, monthBefore } from "../lib/credit-card";
const tx = (id: string, date: string, amount: number, primary = "FOOD_AND_DRINK", pending = false) => ({ transaction_id: id, date, amount, pending, name: id, iso_currency_code: "USD", personal_finance_category: { primary, detailed: primary, confidence_level: "HIGH" } }) as Transaction;
const raw = [tx("purchase", "2026-09-10", 100), tx("refund", "2026-09-11", -20), tx("payment", "2026-09-12", -100, "LOAN_PAYMENTS"), tx("transfer", "2026-09-13", 1000, "TRANSFER_OUT"), tx("pending", "2026-09-14", 40, undefined, true), tx("prev", "2026-08-10", 50), tx("later", "2026-08-30", 200), { ...tx("eur", "2026-09-10", 900), iso_currency_code: "EUR" }];
const report = spendingSummary(raw.map(normalizeCharge), "2026-09", "2026-09-16");
assert.equal(report.total, 80); assert.equal(report.previousTotal, 50); assert.equal(report.percent, 60); assert.equal(report.pending, 40); assert.equal(report.refunds, 20); assert.equal(report.categories.length, 1);
assert.equal(monthBefore("2026-01"), "2025-12");
assert.equal(spendingSummary(raw.map(normalizeCharge), "2026-08", "2026-09-16").total, 250);
assert.equal(spendingSummary([], "2026-09", "2026-09-16").percent, null);
assert.equal(spendingSummary([tx("feb", "2024-02-29", 20)].map(normalizeCharge), "2024-03", "2024-03-31").previousTotal, 20);
assert.equal(spendingSummary([tx("a", "2026-09-10", 0.1), tx("b", "2026-09-10", 0.2)].map(normalizeCharge), "2026-09", "2026-09-16").total, 0.3);
async function main() {
 const result = await collectCardTransactions(async offset => ({ transactions: raw.slice(offset, offset + 2), total_transactions: raw.length }));
 assert.equal(result.length, raw.length);
 await assert.rejects(collectCardTransactions(async offset => ({ transactions: raw.slice(0, 1), total_transactions: offset ? 3 : 2 })), /changed/);
 await assert.rejects(collectCardTransactions(async () => ({ transactions: [], total_transactions: 2 })), /complete/);
 await assert.rejects(collectCardTransactions(async () => ({ transactions: raw.slice(0, 1), total_transactions: 2 })), /changed/);
 assert.deepEqual(await collectCardTransactions(async () => ({ transactions: [], total_transactions: 0 })), []);
 console.log("Credit-card analysis and complete-pagination tests passed.");
}
void main();
