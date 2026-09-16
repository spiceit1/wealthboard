"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlaidConnectButton } from "@/components/connections/plaid-connect-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatUSD, formatDateTimeEastern } from "@/lib/formatters";
import { monthBefore, spendingSummary, type LinkedCard, type CardCharge } from "@/lib/credit-card";

type History = { charges: CardCharge[]; today: string; startDate: string; lastUpdated: string | null };
async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to load card data. Please refresh.");
  return body;
}
const monthName = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
export function CreditCardOverview() {
  const [selected, setSelected] = useState("");
  const cards = useQuery({ queryKey: ["credit-card", "accounts"], queryFn: () => read<{ cards: LinkedCard[]; warnings: string[] }>("/api/credit-card"), staleTime: 300000, retry: false });
  const card = cards.data?.cards.find(c => c.accountId === selected) ?? cards.data?.cards.find(c => c.transactionsAllowed) ?? cards.data?.cards[0];
  return <div className="space-y-6">
    <section className="space-y-2"><h1 className="wb-page-title">Credit Card</h1><p className="text-sm text-muted-foreground">Robinhood card spending · Used by your wife</p><p className="text-sm text-muted-foreground">See where spending goes and how it changes over time.</p></section>
    {cards.isPending && <p role="status">Checking your linked cards…</p>}
    {cards.error && <p role="alert">{cards.error.message}</p>}
    {cards.data?.warnings.map(w => <p role="alert" key={w}>{w}</p>)}
    {cards.data && !cards.data.cards.length && <Card><CardHeader><CardTitle>Connect your card’s charges</CardTitle></CardHeader><CardContent className="space-y-3"><p>Your current connections have not shared a credit card with WealthBoard. Seeing the card in Robinhood does not automatically share its charges with this app.</p><p>Connect the Robinhood credit card below and select the card when Plaid asks which accounts to share. Your investment connection stays in place.</p></CardContent></Card>}
    {cards.data && cards.data.cards.length > 1 && <label className="block">Card<select className="ml-3 rounded border p-2" value={card?.accountId ?? ""} onChange={e => setSelected(e.target.value)}>{cards.data.cards.map(c => <option key={c.accountId} value={c.accountId}>{c.name} {c.mask ? `ending ${c.mask}` : ""}</option>)}</select></label>}
    {card && <Card><CardHeader><CardTitle>{card.name}{card.mask ? ` · ending ${card.mask}` : ""}</CardTitle></CardHeader><CardContent className="space-y-2"><p>Reported card balance: {card.balance === null ? "Unavailable" : card.currency === "Unknown" ? `${card.balance.toFixed(2)} (currency not reported)` : new Intl.NumberFormat("en-US", { style: "currency", currency: card.currency === "Unknown" ? "USD" : card.currency }).format(card.balance)}</p><p className="text-xs text-muted-foreground">Card balances and spending are separate from bank cash and portfolio totals.</p>{!card.transactionsAllowed && <p>Card details are visible, but transaction permission has not been shared. Use Connect Robinhood credit card below to authorize charges.</p>}</CardContent></Card>}
    {card?.transactionsAllowed && <CardAnalysis key={card.accountId} card={card} />}
    <div className="flex flex-wrap items-start gap-3"><PlaidConnectButton purpose="credit" /><Button variant="outline" onClick={() => cards.refetch()} disabled={cards.isFetching}>Check connections</Button></div>
    <p className="text-xs text-muted-foreground">Choose the credit card institution in Plaid. If Robinhood’s card is unavailable there, Plaid cannot import its charges yet.</p>
  </div>;
}
function CardAnalysis({ card }: { card: LinkedCard }) {
  const [chosenMonth, setMonth] = useState("");
  const [category, setCategory] = useState("All");
  const [limit, setLimit] = useState(25);
  const history = useQuery({ queryKey: ["credit-card", "history", card.itemId, card.accountId], queryFn: () => read<History>(`/api/credit-card?${new URLSearchParams({ itemId: card.itemId, accountId: card.accountId })}`), staleTime: 300000, refetchInterval: 300000, retry: false });
  const refresh = <div className="flex flex-wrap items-start gap-3"><Button variant="outline" onClick={() => history.refetch()} disabled={history.isFetching}>{history.isFetching ? "Loading charges…" : "Refresh charges"}</Button><PlaidConnectButton purpose="credit" itemId={card.itemId} /></div>;
  if (!history.data) return <div className="space-y-3">{history.isPending ? <p role="status">Loading card history…</p> : <p role="alert">{history.error?.message}</p>}{refresh}</div>;
  const { charges, today, startDate, lastUpdated } = history.data;
  const month = chosenMonth || today.slice(0, 7);
  const months = [today.slice(0, 7)];
  for (let i = 1; i < 12; i++) months.push(monthBefore(months[i - 1]));
  const summary = spendingSummary(charges, month, today, card.currency);
  const earliest = charges.map(c => c.date).sort()[0];
  const categories = [...new Set(charges.filter(c => c.date.startsWith(month)).map(c => c.category))].sort();
  const transactions = charges.filter(c => c.date.startsWith(month) && (category === "All" || c.category === category)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const money = (value: number) => card.currency === "USD" ? formatUSD(value) : `${value.toFixed(2)} ${card.currency}`;
  const monthly = months.map(m => ({ month: m, ...spendingSummary(charges, m, today, card.currency), hasData: charges.some(c => c.date.startsWith(m)) })).reverse();
  const max = Math.max(1, ...monthly.map(m => m.total));
  return <div className="space-y-6">
    {refresh}{history.error && <p role="alert">Refresh failed: {history.error.message} Showing the previously loaded data.</p>}
    <p className="text-xs text-muted-foreground">Plaid last updated: {formatDateTimeEastern(lastUpdated, "Not reported")}. WealthBoard checks every five minutes while this tab is open. Plaid’s bank updates may arrive later; Refresh charges reads what Plaid currently has.</p>
    <div className="rounded-lg border p-4 text-sm space-y-1"><p>Analysis uses available posted charges, subtracts refunds and other purchase credits, and excludes payments, transfers, and pending charges. Dates are posting dates; categories come from Plaid.</p><p>Requested history: {startDate} through {today}. {earliest ? `Earliest returned charge: ${earliest}.` : "No charges have been returned yet."} History may be limited or still loading. Comparisons reflect only the data returned, and missing history is not proof of zero spending.</p></div>
    <label className="block font-medium">Spending month <select className="ml-3 rounded border bg-background p-2" value={month} onChange={e => { setMonth(e.target.value); setCategory("All"); setLimit(25); }}>{months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}</select></label>
    {!charges.length ? <p>No charges available yet. For a new connection, refresh in a few minutes while Plaid prepares the history.</p> : <>
      <div className="grid gap-4 sm:grid-cols-3">{[{ title: "Net spending", value: money(summary.total), note: `${money(summary.purchases)} purchases − ${money(summary.refunds)} credits` }, { title: summary.currentMonth ? "Change vs. last month to date" : "Change vs. previous month", value: `${summary.change > 0 ? "+" : ""}${money(summary.change)}`, note: `${summary.percent === null ? "No percentage baseline" : `${Math.abs(summary.percent).toFixed(1)}% ${summary.percent >= 0 ? "higher" : "lower"}`} · ${summary.currentMonth ? `prior month through day ${summary.comparableDays}` : monthName(monthBefore(month))} (${money(summary.previousTotal)})` }, { title: "Pending — not in spending", value: money(summary.pending), note: "May change before posting" }].map(k => <Card key={k.title}><CardHeader><CardTitle>{k.title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{k.value}</p><p className="mt-2 text-xs text-muted-foreground">{k.note}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Month-to-month spending</CardTitle></CardHeader><CardContent className="space-y-3">{monthly.map(m => <div key={m.month} className="grid grid-cols-[150px_1fr_110px] items-center gap-3 text-sm"><span>{monthName(m.month)}{m.currentMonth ? " (to date)" : ""}</span><div className="h-3 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${Math.max(0, m.total) / max * 100}%` }} /></div><span className="text-right">{m.hasData ? money(m.total) : "No data"}</span></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Spending by category</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Category</th><th className="p-2">Selected month</th><th className="p-2">Previous{summary.currentMonth ? " month to date" : " month"}</th><th className="p-2">Change</th></tr></thead><tbody>{summary.categories.map(c => <tr key={c.category} className="border-t"><td className="p-2">{c.category}</td><td className="p-2">{money(c.amount)}</td><td className="p-2">{money(c.previous)}</td><td className="p-2">{c.amount > c.previous ? "+" : ""}{money(c.amount - c.previous)}</td></tr>)}</tbody></table>{!summary.categories.length && <p>No posted spending returned for these months.</p>}</CardContent></Card>
    </>}
    <Card><CardHeader><CardTitle>Charges and payments</CardTitle></CardHeader><CardContent className="space-y-4"><label>Category <select className="ml-2 rounded border bg-background p-2" value={category} onChange={e => { setCategory(e.target.value); setLimit(25); }}><option>All</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Date", "Merchant / description", "Category", "Amount", "Status"].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{transactions.slice(0, limit).map(t => <tr key={t.id} className="border-t"><td className="whitespace-nowrap p-2">{t.date}</td><td className="p-2">{t.merchant}</td><td className="p-2">{t.category}</td><td className="whitespace-nowrap p-2">{t.currency === card.currency ? money(t.amount) : `${t.amount.toFixed(2)} ${t.currency}`}</td><td className="p-2">{t.pending ? "Pending · excluded" : t.excluded ? "Payment / transfer · excluded" : t.currency !== card.currency ? "Other currency · excluded" : t.amount < 0 ? "Credit / refund" : "Posted"}</td></tr>)}</tbody></table></div>{!transactions.length && <p>No matching transactions returned.</p>}{transactions.length > limit && <Button variant="outline" onClick={() => setLimit(limit + 50)}>Show more ({transactions.length - limit} remaining)</Button>}</CardContent></Card>
  </div>;
}
