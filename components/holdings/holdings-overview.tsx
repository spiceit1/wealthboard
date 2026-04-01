"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { HoldingsSyncButton } from "@/components/holdings/holdings-sync-button";
import { ManualHoldingEditor } from "@/components/holdings/manual-holding-editor";
import { PositionsTable } from "@/components/holdings/positions-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeEastern, formatUSD } from "@/lib/formatters";
import { cn } from "@/lib/utils";

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
  stocksChangeSinceOpen: number | null;
  cryptoChangeSinceOpen: number | null;
  changeSinceLabel: string | null;
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

function oldestIso(values: Array<string | null | undefined>) {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (!times.length) return null;
  return new Date(Math.min(...times)).toISOString();
}

function nyDateKeyFromIso(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function HoldingsOverview() {
  const holdingsQuery = useQuery({
    queryKey: ["holdings-overview"],
    queryFn: fetchHoldings,
  });

  const rows = useMemo(() => holdingsQuery.data?.rows ?? [], [holdingsQuery.data?.rows]);
  const stockRows = useMemo(() => rows.filter((row) => row.assetClass === "stock"), [rows]);
  const cryptoRows = useMemo(() => rows.filter((row) => row.assetClass === "crypto"), [rows]);
  const stockTotal = useMemo(() => stockRows.reduce((sum, row) => sum + row.marketValue, 0), [stockRows]);
  const cryptoTotal = useMemo(
    () => cryptoRows.reduce((sum, row) => sum + row.marketValue, 0),
    [cryptoRows],
  );
  const stocksAsOf = useMemo(() => latestIso(stockRows.map((row) => row.updatedAt)), [stockRows]);
  const stocksOldestAsOf = useMemo(() => oldestIso(stockRows.map((row) => row.updatedAt)), [stockRows]);
  const cryptoAsOf = useMemo(() => latestIso(cryptoRows.map((row) => row.updatedAt)), [cryptoRows]);
  const stocksFreshTodayCount = useMemo(() => {
    const todayNy = nyDateKeyFromIso(new Date().toISOString());
    return stockRows.filter((row) => row.updatedAt && nyDateKeyFromIso(row.updatedAt) === todayNy).length;
  }, [stockRows]);
  const stocksChangeSinceOpen = holdingsQuery.data?.stocksChangeSinceOpen ?? null;
  const cryptoChangeSinceOpen = holdingsQuery.data?.cryptoChangeSinceOpen ?? null;
  const changeSinceLabel = holdingsQuery.data?.changeSinceLabel ?? "since 9:00 ET";

  if (holdingsQuery.isPending) {
    return (
      <div className="wb-fade-in space-y-6">
        <section className="space-y-2">
          <h1 className="wb-page-title">Holdings</h1>
          <p className="text-sm text-muted-foreground">
            Manual stock and crypto quantities with sync-driven price refresh.
          </p>
          <HoldingsSyncButton />
        </section>
        <Card className="wb-card-hover">
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="wb-card-hover">
            <CardHeader>
              <CardTitle className="text-base">Stocks Total</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-36" />
            </CardContent>
          </Card>
          <Card className="wb-card-hover">
            <CardHeader>
              <CardTitle className="text-base">Crypto Total</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-36" />
            </CardContent>
          </Card>
        </div>
        <Card className="wb-card-hover">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (holdingsQuery.isError) {
    return (
      <div className="wb-fade-in">
        <p className="text-sm text-red-500">Unable to load holdings right now.</p>
      </div>
    );
  }

  return (
    <div className="wb-fade-in space-y-6">
      <section className="space-y-2">
        <h1 className="wb-page-title">Holdings</h1>
        <p className="text-sm text-muted-foreground">
          Manual stock and crypto quantities with sync-driven price refresh.
        </p>
        <HoldingsSyncButton />
      </section>

      <ManualHoldingEditor />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="wb-card-hover">
          <CardHeader>
            <CardTitle className="text-base">Stocks Total</CardTitle>
            <CardDescription>
              As of {formatDateTimeEastern(stocksAsOf)} ({stocksFreshTodayCount}/{stockRows.length} symbols fresh
              today)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl tabular-nums">{formatUSD(stockTotal)}</p>
              {stocksChangeSinceOpen != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    stocksChangeSinceOpen >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700",
                  )}
                >
                  {stocksChangeSinceOpen >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {stocksChangeSinceOpen >= 0 ? "+" : ""}
                  {formatUSD(Math.abs(stocksChangeSinceOpen))}
                </span>
              )}
            </div>
            {stocksChangeSinceOpen != null && (
              <p className="text-[11px] text-muted-foreground">{changeSinceLabel}</p>
            )}
            {stocksAsOf && stocksOldestAsOf && stocksAsOf !== stocksOldestAsOf && (
              <p className="text-[11px] text-amber-700">
                Includes stale symbol quotes (oldest {formatDateTimeEastern(stocksOldestAsOf)}).
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="wb-card-hover">
          <CardHeader>
            <CardTitle className="text-base">Crypto Total</CardTitle>
            <CardDescription>As of {formatDateTimeEastern(cryptoAsOf)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl tabular-nums">{formatUSD(cryptoTotal)}</p>
              {cryptoChangeSinceOpen != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    cryptoChangeSinceOpen >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700",
                  )}
                >
                  {cryptoChangeSinceOpen >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {cryptoChangeSinceOpen >= 0 ? "+" : ""}
                  {formatUSD(Math.abs(cryptoChangeSinceOpen))}
                </span>
              )}
            </div>
            {cryptoChangeSinceOpen != null && (
              <p className="text-[11px] text-muted-foreground">{changeSinceLabel}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="wb-card-hover">
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <PositionsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
