"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/formatters";

type HistoryRow = {
  date: string;
  cash: string | number;
  stocks: string | number;
  crypto: string | number;
  total: string | number;
  dailyChange: string | number;
};

type HistoryResponse = {
  rows: HistoryRow[];
};

async function fetchHistory(): Promise<HistoryResponse> {
  const response = await fetch("/api/history", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load history.");
  return response.json();
}

export function HistoryOverview() {
  const historyQuery = useQuery({
    queryKey: ["history-overview"],
    queryFn: fetchHistory,
  });

  const rows = historyQuery.data?.rows ?? [];

  if (historyQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (historyQuery.isError) {
    return <p className="text-sm text-red-500">Unable to load history right now.</p>;
  }

  return (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Daily net worth snapshots from scheduled syncs.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Daily Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Net Worth</th>
                  <th className="py-2 pr-4">Cash</th>
                  <th className="py-2 pr-4">Stocks</th>
                  <th className="py-2 pr-4">Crypto</th>
                  <th className="py-2 pr-4">Daily Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const netWorth = Number(row.total);
                  const change = Number(row.dailyChange);
                  return (
                    <tr key={row.date} className="border-b">
                      <td className="py-2 pr-4">
                        <Link href={`/history/${row.date}`} className="underline underline-offset-4">
                          {row.date}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{formatUSD(netWorth)}</td>
                      <td className="py-2 pr-4">{formatUSD(Number(row.cash))}</td>
                      <td className="py-2 pr-4">{formatUSD(Number(row.stocks))}</td>
                      <td className="py-2 pr-4">{formatUSD(Number(row.crypto))}</td>
                      <td className={`py-2 pr-4 ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {change >= 0 ? "+" : ""}
                        {formatUSD(change)}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={6}>
                      No history snapshots yet.
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

