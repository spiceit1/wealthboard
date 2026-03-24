"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/formatters";

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
      <>
        <Card>
          <CardHeader>
            <CardTitle>Cash Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Brokerage Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </CardContent>
        </Card>
      </>
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

  return (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Snapshot Detail: {date}</h1>
        <p className="text-sm text-muted-foreground">
          Net worth: {formatUSD(Number(detail.snapshot.totalNetWorth))}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Cash Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cashAccounts.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b pb-2">
              <span>{item.label}</span>
              <span>{formatUSD(Number(item.value))}</span>
            </div>
          ))}
          {!cashAccounts.length && <p className="text-muted-foreground">No cash accounts.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brokerage Positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {brokerage.map((item) => (
            <div key={item.id} className="grid grid-cols-4 gap-2 border-b pb-2">
              <span>{item.symbol}</span>
              <span>Qty: {Number(item.quantity ?? 0).toFixed(4)}</span>
              <span>Price: {formatUSD(Number(item.price ?? 0))}</span>
              <span>Value: {formatUSD(Number(item.value))}</span>
            </div>
          ))}
          {!brokerage.length && <p className="text-muted-foreground">No brokerage positions.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crypto Holdings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {crypto.map((item) => (
            <div key={item.id} className="grid grid-cols-3 gap-2 border-b pb-2">
              <span>{item.symbol}</span>
              <span>Qty: {Number(item.quantity ?? 0).toFixed(6)}</span>
              <span>Value: {formatUSD(Number(item.value))}</span>
            </div>
          ))}
          {!crypto.length && <p className="text-muted-foreground">No crypto holdings.</p>}
        </CardContent>
      </Card>
    </>
  );
}

