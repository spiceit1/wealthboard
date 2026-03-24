"use client";

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
  balance: number;
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
  });

  const bankRows = useMemo(
    () =>
      (accountsQuery.data?.rows ?? []).filter(
        (row) => row.type === "checking" || row.type === "savings",
      ),
    [accountsQuery.data?.rows],
  );

  const cashTotal = useMemo(
    () => bankRows.reduce((sum, row) => sum + row.balance, 0),
    [bankRows],
  );

  if (accountsQuery.isPending) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bank Cash Total</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-40" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bank Account Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bank Cash Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(cashTotal)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Institution</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Balance</th>
                  <th className="py-2 pr-4">As Of</th>
                </tr>
              </thead>
              <tbody>
                {bankRows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-4">{row.institutionName}</td>
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 capitalize">{row.type.replace("_", " ")}</td>
                    <td className="py-2 pr-4">{formatUSD(row.balance)}</td>
                    <td className="py-2 pr-4">{formatDateTimeEastern(row.balanceAsOf)}</td>
                  </tr>
                ))}
                {!bankRows.length && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={5}>
                      No bank accounts found.
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

