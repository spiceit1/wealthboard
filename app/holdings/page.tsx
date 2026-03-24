import { AppNav } from "@/components/shared/app-nav";
import { ManualHoldingEditor } from "@/components/holdings/manual-holding-editor";
import { PositionsTable } from "@/components/holdings/positions-table";
import { HoldingsSyncButton } from "@/components/holdings/holdings-sync-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeEastern, formatUSD } from "@/lib/formatters";
import { getDemoUserId, getHoldingsOverview } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

function latestIso(values: Array<Date | null | undefined>) {
  const times = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

export default async function HoldingsPage() {
  const userId = await getDemoUserId();
  const rows = userId ? await getHoldingsOverview(userId) : [];
  const stockRows = rows.filter((row) => row.assetClass === "stock");
  const cryptoRows = rows.filter((row) => row.assetClass === "crypto");
  const stockTotal = stockRows
    .reduce((sum, row) => sum + row.marketValue, 0);
  const cryptoTotal = cryptoRows
    .reduce((sum, row) => sum + row.marketValue, 0);
  const stocksAsOf = latestIso(stockRows.map((row) => row.updatedAt));
  const cryptoAsOf = latestIso(cryptoRows.map((row) => row.updatedAt));

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

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
    </main>
  );
}
