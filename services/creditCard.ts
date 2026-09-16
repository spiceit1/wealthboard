import { getPlaidClient } from "@/lib/plaid";
import { getPlaidAccessTokensForUser } from "@/services/plaidTokens";
import { collectCardTransactions, normalizeCharge, type LinkedCard } from "@/lib/credit-card";
import { Products } from "plaid";

export function cardError(error: unknown) {
  const code = (error as { response?: { data?: { error_code?: string } } }).response?.data?.error_code;
  if (code === "PRODUCT_NOT_READY") return "Plaid is preparing the card history. Please refresh in a few minutes.";
  if (code === "ITEM_LOGIN_REQUIRED") return "The card needs authorization again. Use Reconnect below.";
  if (code === "ADDITIONAL_CONSENT_REQUIRED" || code === "PRODUCTS_NOT_SUPPORTED") return "Transaction access is not available on this connection. Connect the credit card separately below.";
  return code ? `Plaid could not load the card (${code}). Please try again.` : "Unable to load complete card data. Please refresh or reconnect.";
}
export async function getCreditCards(userId: string) {
  const plaid = getPlaidClient();
  const tokens = await getPlaidAccessTokensForUser(userId);
  const results = await Promise.all(tokens.map(async token => {
    try {
      const [accounts, item] = await Promise.all([
        plaid.accountsGet({ access_token: token.accessToken }, { timeout: 12000 }),
        plaid.itemGet({ access_token: token.accessToken }, { timeout: 12000 }),
      ]);
      const consent = item.data.item.consented_products;
      const allowed = consent ? consent.includes(Products.Transactions) : (item.data.item.products ?? item.data.item.billed_products).includes(Products.Transactions);
      const cards: LinkedCard[] = accounts.data.accounts.filter(a => a.type === "credit" && a.subtype === "credit card").map(a => ({ itemId: token.itemId, accountId: a.account_id, name: a.official_name || a.name, mask: a.mask, balance: a.balances.current, currency: a.balances.iso_currency_code ?? "Unknown", transactionsAllowed: allowed, lastUpdated: item.data.status?.transactions?.last_successful_update ?? null }));
      return { cards, warning: null };
    } catch (error) { return { cards: [], warning: cardError(error) }; }
  }));
  return { cards: results.flatMap(r => r.cards), warnings: [...new Set(results.flatMap(r => r.warning ? [r.warning] : []))] };
}
export async function getCardHistory(userId: string, itemId: string, accountId: string) {
  const token = (await getPlaidAccessTokensForUser(userId)).find(t => t.itemId === itemId);
  if (!token) throw new Error("Card not found");
  const plaid = getPlaidClient();
  const accounts = await plaid.accountsGet({ access_token: token.accessToken }, { timeout: 10000 });
  const account = accounts.data.accounts.find(a => a.account_id === accountId && a.type === "credit" && a.subtype === "credit card");
  if (!account) throw new Error("Card not found");
  const item = await plaid.itemGet({ access_token: token.accessToken }, { timeout: 10000 });
  const consent = item.data.item.consented_products ?? item.data.item.products ?? item.data.item.billed_products;
  if (!consent.includes(Products.Transactions)) throw new Error("Transaction authorization required");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - 364);
  const startDate = start.toISOString().slice(0, 10);
  const deadline = Date.now() + 25000;
  const rows = await collectCardTransactions(async offset => {
    if (Date.now() > deadline) throw new Error("History timed out");
    return (await plaid.transactionsGet({ access_token: token.accessToken, start_date: startDate, end_date: today, options: { account_ids: [accountId], count: 500, offset } }, { timeout: 10000 })).data;
  });
  return { charges: rows.map(normalizeCharge), today, startDate, lastUpdated: item.data.status?.transactions?.last_successful_update ?? null };
}
