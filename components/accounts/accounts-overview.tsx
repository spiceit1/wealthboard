"use client";

import { ManualBalanceEditor } from "@/components/accounts/manual-balance-editor";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeEastern, formatUSD } from "@/lib/formatters";

type AccountRow = {
  id: string;
  institutionName: string;
  name: string;
  type: string;
  balance: number | null;
  investments: number | null;
  total: number | null;
  investmentsAsOf: string | null;
  investmentsSource: string;
  balanceSource: string;
  balanceAsOf: string | null;
};

type AccountsResponse = {
  rows: AccountRow[];
};

async function fetchAccounts(): Promise<AccountsResponse> {
  const response = await fetch("/api/accounts", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load accounts.");
  return response.json();
}

export function AccountsOverview() {
  const accountsQuery = useQuery({
    queryKey: ["accounts-overview"],
    queryFn: fetchAccounts,
    refetchInterval: 15_000,
  });

  const accountRows = accountsQuery.data?.rows ?? [];

  const cashTotal = useMemo(
    () => accountRows.reduce((sum, row) => sum + (row.balance ?? 0), 0),
    [accountRows],
  );

  if (accountsQuery.isPending) {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-1">
          <Card className="wb-card-hover">
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-44" />
            </CardContent>
          </Card>
        </div>
        <Card className="wb-card-hover">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-4 border-b pb-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (accountsQuery.isError) {
    return <p className="text-sm text-red-500">Unable to load account balances right now.</p>;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-1">
        <Card className="wb-card-hover">
          <CardHeader>
            <CardTitle className="text-base">Bank & Brokerage Cash</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{formatUSD(cashTotal)}</CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">Robinhood cash and quantities refresh with the daily sync at 9:00 a.m. Eastern, using the latest data Plaid supplies. Stock prices refresh separately. To share a new account, use <a className="underline" href="/connections">Connections → Manage account access → Robinhood Investments & cash</a>, keeping your existing accounts selected. Plaid checked times show when data was retrieved; the broker data may be older. Verified Robinhood balances are retained until Plaid matches. A Manual badge means automatic cash updates are not active for that row.</p>
      <Card className="wb-card-hover">
        <CardHeader>
          <CardTitle>Your Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Cash and investments are shown separately. These are the same holdings used on your dashboard—not additional assets. “Not available” means a balance has not been supplied, not zero.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Institution</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Cash</th>
                  <th className="py-2 pr-4">Investments</th>
                  <th className="py-2 pr-4">Total Value</th>
                  <th className="py-2 pr-4">Last Checked / Verified</th>
                  <th className="py-2 pr-4">Update</th>
                </tr>
              </thead>
              <tbody>
                {accountRows.map((row) => (
                  <tr key={row.id} className="wb-table-row">
                    <td className="py-2 pr-4">{row.institutionName}</td>
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 capitalize">{row.type.replace("_", " ")}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.balance === null ? "Not available" : formatUSD(row.balance)}{row.balanceSource === "manual" && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Manual</span>}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.investments === null ? <a className="underline" href="/connections">Holdings permission needed</a> : formatUSD(row.investments)}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.total === null ? <span>{formatUSD((row.balance ?? 0) + (row.investments ?? 0))}<span className="block text-xs text-muted-foreground">{row.balance === null ? "Cash not included" : "Holdings not included"}</span></span> : formatUSD(row.total)}</td>
                    <td className="py-2 pr-4 text-xs">{row.balanceAsOf && <div>Cash: {formatDateTimeEastern(row.balanceAsOf)} · {row.balanceSource === "robinhood_verified" ? "Verified with Robinhood · awaiting Plaid" : row.balanceSource === "manual" ? "Manual" : "Plaid checked"}</div>}{row.investmentsAsOf && <div>Holdings: {formatDateTimeEastern(row.investmentsAsOf)} · {row.investmentsSource === 'robinhood_verified' ? 'Verified with Robinhood · awaiting Plaid' : row.investmentsSource === 'manual' ? 'Manual quantities' : 'Plaid'}</div>}</td>
                    <td className="py-2 pr-4">{row.balance !== null ? <ManualBalanceEditor accountId={row.id} name={`${row.name} cash`} balance={row.balance} /> : <a className="underline" href="/connections">Manage connection</a>}</td>
                  </tr>
                ))}
                {!accountRows.length && (
                  <tr className="wb-table-row">
                    <td className="py-3 text-muted-foreground" colSpan={8}>
                      No cash accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

