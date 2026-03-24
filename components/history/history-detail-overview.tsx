"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type SnapshotItem = {
  id: string;
  category: "cash_account" | "brokerage_position" | "crypto_holding";
  label: string;
  symbol: string | null;
  quantity: string | number | null;
  price: string | number | null;
  value: string | number;
};

type SnapshotDetail = {
  snapshot: {
    totalNetWorth: string | number;
  };
  items: SnapshotItem[];
} | null;

type DetailResponse = {
  detail: SnapshotDetail;
};

type Props = {
  date: string;
};

async function fetchDetail(date: string): Promise<DetailResponse> {
  const response = await fetch(`/api/history/${date}`, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load snapshot detail.");
  return response.json();
}

export function HistoryDetailOverview({ date }: Props) {
  const detailQuery = useQuery({
    queryKey: ["history-detail", date],
    queryFn: () => fetchDetail(date),
  });

  if (detailQuery.isPending) {
    return (
      <section className="space-y-6 wb-fade-in">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        {(["Cash Accounts", "Brokerage Positions", "Crypto Holdings"] as const).map((label) => (
          <Card key={label} className="wb-card-hover">
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  if (detailQuery.isError) {
    return <p className="text-sm text-red-500">Unable to load this snapshot right now.</p>;
  }

  const detail = detailQuery.data?.detail ?? null;
  if (!detail) {
    return (
      <p className="text-sm text-muted-foreground">
        Snapshot not found for {date}. Go back to{" "}
        <Link href="/history" className="underline underline-offset-4">
          history
        </Link>
        .
      </p>
    );
  }

  const cashAccounts = detail.items.filter((item) => item.category === "cash_account");
  const brokerage = detail.items.filter((item) => item.category === "brokerage_position");
  const crypto = detail.items.filter((item) => item.category === "crypto_holding");

  const rowDivider = "border-b border-border/60 pb-3 last:border-0 last:pb-0";

  return (
    <section className="space-y-6 wb-fade-in">
      <div className="space-y-2">
        <h1 className="wb-page-title">Snapshot Detail: {date}</h1>
        <p className="text-sm text-muted-foreground">
          Net worth:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatUSD(Number(detail.snapshot.totalNetWorth))}
          </span>
        </p>
      </div>

      <Card className="wb-card-hover">
        <CardHeader>
          <CardTitle className="wb-section-title">Cash Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {cashAccounts.map((item) => (
            <div key={item.id} className={cn("flex items-center justify-between gap-4", rowDivider)}>
              <span>{item.label}</span>
              <span className="shrink-0 tabular-nums font-medium">{formatUSD(Number(item.value))}</span>
            </div>
          ))}
          {!cashAccounts.length && (
            <p className="text-sm text-muted-foreground">No cash accounts.</p>
          )}
        </CardContent>
      </Card>

      <Card className="wb-card-hover">
        <CardHeader>
          <CardTitle className="wb-section-title">Brokerage Positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {brokerage.map((item) => (
            <div
              key={item.id}
              className={cn("grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4", rowDivider)}
            >
              <span className="font-medium text-foreground sm:col-span-1">{item.symbol}</span>
              <span className="text-muted-foreground">
                Qty: <span className="tabular-nums text-foreground">{Number(item.quantity ?? 0).toFixed(4)}</span>
              </span>
              <span className="text-muted-foreground">
                Price:{" "}
                <span className="tabular-nums text-foreground">{formatUSD(Number(item.price ?? 0))}</span>
              </span>
              <span className="text-muted-foreground sm:text-right">
                Value:{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {formatUSD(Number(item.value))}
                </span>
              </span>
            </div>
          ))}
          {!brokerage.length && (
            <p className="text-sm text-muted-foreground">No brokerage positions.</p>
          )}
        </CardContent>
      </Card>

      <Card className="wb-card-hover">
        <CardHeader>
          <CardTitle className="wb-section-title">Crypto Holdings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {crypto.map((item) => (
            <div key={item.id} className={cn("grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-3", rowDivider)}>
              <span className="font-medium text-foreground">{item.symbol}</span>
              <span className="text-muted-foreground">
                Qty: <span className="tabular-nums text-foreground">{Number(item.quantity ?? 0).toFixed(6)}</span>
              </span>
              <span className="text-muted-foreground sm:text-right">
                Value:{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {formatUSD(Number(item.value))}
                </span>
              </span>
            </div>
          ))}
          {!crypto.length && (
            <p className="text-sm text-muted-foreground">No crypto holdings.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

