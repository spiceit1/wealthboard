"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { monthBefore, type LinkedCard, type CardCharge } from "@/lib/credit-card";
import { formatDateTimeEastern } from "@/lib/formatters";

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Unable to load bank transactions.");
  return body;
}
const money = (value: number, currency: string) => /^[A-Z]{3}$/.test(currency)
  ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
  : `${value.toFixed(2)} ${currency}`;

export function BankTransactions() {
  const [selected, setSelected] = useState("");
  const accounts = useQuery({ queryKey: ["bank-transactions", "accounts"], queryFn: () => read<{ accounts: LinkedCard[]; warnings: string[] }>("/api/bank-transactions"), retry: false, staleTime: 300000 });
  const key = (a: LinkedCard) => `${a.itemId}:${a.accountId}`;
  const account = accounts.data?.accounts.find(a => key(a) === selected) ?? accounts.data?.accounts[0];
  return <section className="space-y-6">
    <div><h1 className="wb-page-title">Bank Transactions</h1><p className="text-sm text-muted-foreground">Deposits, withdrawals, purchases, and transfers for your linked bank accounts.</p></div>
    {accounts.isPending && <p role="status">Loading your bank accounts…</p>}
    {accounts.error && <p role="alert">{accounts.error.message}</p>}
    {accounts.data?.warnings.map(w => <p role="alert" key={w}>{w}</p>)}
    {accounts.data && !accounts.data.accounts.length && <p>No bank accounts were returned. <Link className="underline" href="/connections">Review your bank connections</Link>.</p>}
    {account && <label className="block">Bank account <select className="ml-2 rounded border bg-background p-2" value={key(account)} onChange={e => setSelected(e.target.value)}>{accounts.data?.accounts.map(a => <option key={key(a)} value={key(a)}>{a.name}{a.mask ? ` · ending ${a.mask}` : ""}</option>)}</select></label>}
    {account && (account.transactionsAllowed ? <BankHistory key={key(account)} account={account} /> : <p>Transaction permission has not been shared for this bank account. Open <Link className="underline" href="/connections">Connections</Link> and use this bank’s Reconnect button to review its permissions.</p>)}
    <Button variant="outline" disabled={accounts.isFetching} onClick={() => accounts.refetch()}>Check bank connections</Button>
  </section>;
}

function BankHistory({ account }: { account: LinkedCard }) {
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [limit, setLimit] = useState(50);
  const history = useQuery({ queryKey: ["bank-transactions", account.itemId, account.accountId], queryFn: () => read<{ transactions: CardCharge[]; today: string; startDate: string; lastUpdated: string | null }>(`/api/bank-transactions?${new URLSearchParams({ itemId: account.itemId, accountId: account.accountId })}`), staleTime: 300000, refetchInterval: 300000, retry: false });
  const refresh = <Button variant="outline" disabled={history.isFetching} onClick={() => history.refetch()}>{history.isFetching ? "Loading transactions…" : "Refresh transactions"}</Button>;
  if (!history.data) return <div className="space-y-3">{history.isPending ? <p role="status">Loading bank transaction history…</p> : <p role="alert">{history.error?.message}</p>}{refresh}<Link href="/connections" className="ml-3 underline">Manage connections</Link></div>;
  const { transactions, today, startDate, lastUpdated } = history.data;
  const chosen = month || today.slice(0, 7);
  const months = [today.slice(0, 7)];
  while (`${months[months.length - 1]}-01` > startDate) months.push(monthBefore(months[months.length - 1]));
  const monthly = transactions.filter(t => t.date.startsWith(chosen));
  const posted = monthly.filter(t => !t.pending && t.currency === account.currency);
  const incoming = posted.filter(t => t.amount < 0).reduce((s, t) => s - Math.round(t.amount * 100), 0) / 100;
  const outgoing = posted.filter(t => t.amount > 0).reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
  const rows = monthly.filter(t => `${t.merchant} ${t.category}`.toLowerCase().includes(search.toLowerCase()) && (direction === "all" || (direction === "in" ? t.amount < 0 : t.amount > 0))).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return <div className="space-y-5">
    {refresh}{history.error && <p role="alert">Refresh failed: {history.error.message} Previously loaded transactions are shown.</p>}
    <p className="text-xs text-muted-foreground">Plaid last updated: {formatDateTimeEastern(lastUpdated, "Not reported")}. Checks every five minutes while this page is open. Refresh retrieves Plaid’s available history; banks may report new transactions later.</p>
    <div className="flex flex-wrap gap-4">
      <label>Month <select className="rounded border bg-background p-2" value={chosen} onChange={e => { setMonth(e.target.value); setLimit(50); }}>{months.map(m => <option key={m} value={m}>{new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}</select></label>
      <label>Search <input className="rounded border bg-background p-2" placeholder="Description or category" value={search} onChange={e => { setSearch(e.target.value); setLimit(50); }} /></label>
      <label>Show <select className="rounded border bg-background p-2" value={direction} onChange={e => { setDirection(e.target.value); setLimit(50); }}><option value="all">All transactions</option><option value="in">Money in</option><option value="out">Money out</option></select></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">{[["Money in", incoming], ["Money out", outgoing], ["Net cash movement", incoming - outgoing]].map(([title, value]) => <Card key={title}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold">{posted.length ? money(Number(value), account.currency) : "No posted transactions"}</p></CardContent></Card>)}</div>
    <p className="text-sm text-muted-foreground">Totals cover available posted transactions for the selected month in {account.currency}, including transfers. They exclude pending transactions and are not a measure of income or spending. Search and direction filters only change the table.</p>
    <Card><CardHeader><CardTitle>Transaction history</CardTitle></CardHeader><CardContent className="space-y-4 overflow-x-auto">
      <table className="w-full text-left text-sm"><thead><tr>{["Date", "Description", "Category", "Money in", "Money out", "Status"].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(0, limit).map(t => <tr className="border-t" key={t.id}><td className="whitespace-nowrap p-2">{t.date}</td><td className="p-2">{t.merchant}</td><td className="p-2">{t.category}</td><td className="whitespace-nowrap p-2">{t.amount < 0 ? money(-t.amount, t.currency) : "—"}</td><td className="whitespace-nowrap p-2">{t.amount > 0 ? money(t.amount, t.currency) : "—"}</td><td className="p-2">{t.pending ? "Pending" : "Posted"}</td></tr>)}</tbody></table>
      {!rows.length && <p>No matching transactions returned for this month. Missing history does not mean there were no transactions.</p>}
      {rows.length > limit && <Button variant="outline" onClick={() => setLimit(limit + 50)}>Show more ({rows.length - limit} remaining)</Button>}
      <p className="text-xs text-muted-foreground">Requested history: {startDate} through {today}. History may be limited or still loading. Dates and categories are supplied by Plaid; pending entries may change before posting.</p>
    </CardContent></Card>
  </div>;
}
