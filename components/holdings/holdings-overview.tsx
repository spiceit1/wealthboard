"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { HoldingsSyncButton } from "@/components/holdings/holdings-sync-button";
import { ManualHoldingEditor } from "@/components/holdings/manual-holding-editor";
import { PositionsTable } from "@/components/holdings/positions-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeEastern, formatUSD } from "@/lib/formatters";

type HoldingRow = {
  id: string;
  symbol: string;
  name: string;
  assetClass: "cash" | "stock" | "crypto";
  quantity: number;
  lastPrice: number;
  marketValue: number;
  isManual: boolean;
  updatedAt: string | null;
};

type HoldingsResponse = {
  rows: HoldingRow[];
};

async function fetchHoldings(): Promise<HoldingsResponse> {
  const response = await fetch("/api/holdings", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load holdings.");
  return response.json();
}

function latestIso(values: Array<string | null | undefined>) {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

export function HoldingsOverview() {
  const holdingsQuery = useQuery({
    queryKey: ["holdings-overview"],
    queryFn: fetchHoldings,
  });

  const rows = holdingsQuery.data?.rows ?? [];
  const stockRows = useMemo(() => rows.filter((row) => row.assetClass === "stock"), [rows]);
  const cryptoRows = useMemo(() => rows.filter((row) => row.assetClass === "crypto"), [rows]);
  const stockTotal = useMemo(() => stockRows.reduce((sum, row) => sum + row.marketValue, 0), [stockRows]);
  const cryptoTotal = useMemo(
    () => cryptoRows.reduce((sum, row) => sum + row.marketValue, 0),
    [cryptoRows],
  );
  const stocksAsOf = useMemo(() => latestIso(stockRows.map((row) => row.updatedAt)), [stockRows]);
  const cryptoAsOf = useMemo(() => latestIso(cryptoRows.map((row) => row.updatedAt)), [cryptoRows]);

  if (holdingsQuery.isPending) {
    return (
      <>
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
          <p className="text-sm text-muted-foreground">
            Manual stock and crypto quantities with sync-driven price refresh.
          </p>
          <HoldingsSyncButton />
        </section>
        <div className="space-y-3 rounded-md border p-3">
          <Skeleton className="h-5 w-56" />
          <div className="grid gap-2 md:grid-cols-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stocks Total</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-36" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Crypto Total</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-36" />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (holdingsQuery.isError) {
    return <p className="text-sm text-red-500">Unable to load holdings right now.</p>;
  }

  return (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
        <p className="text-sm text-muted-foreground">
          Manual stock and crypto quantities with sync-driven price refresh.
        </p>
        <HoldingsSyncButton />
      </section>

      <ManualHoldingEditor rows={rows} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stocks Total</CardTitle>
            <CardDescription>As of {formatDateTimeEastern(stocksAsOf)}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(stockTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crypto Total</CardTitle>
            <CardDescription>As of {formatDateTimeEastern(cryptoAsOf)}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(cryptoTotal)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <PositionsTable rows={rows} />
        </CardContent>
      </Card>
    </>
  );
}

