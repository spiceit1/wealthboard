import Link from "next/link";

import { AppNav } from "@/components/shared/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUSD } from "@/lib/formatters";
import { getDemoUserId, getSnapshotDetail } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ date: string }>;
};

export default async function HistoryDetailPage({ params }: Props) {
  const { date } = await params;
  const userId = await getDemoUserId();
  const detail = userId ? await getSnapshotDetail(userId, date) : null;

  if (!detail) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <AppNav />
        <p className="text-sm text-muted-foreground">
          Snapshot not found for {date}. Go back to{" "}
          <Link href="/history" className="underline underline-offset-4">
            history
          </Link>
          .
        </p>
      </main>
    );
  }

  const cashAccounts = detail.items.filter((item) => item.category === "cash_account");
  const brokerage = detail.items.filter((item) => item.category === "brokerage_position");
  const crypto = detail.items.filter((item) => item.category === "crypto_holding");

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

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
        </CardContent>
      </Card>
    </main>
  );
}
