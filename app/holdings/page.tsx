import { AppNav } from "@/components/shared/app-nav";
import { ManualHoldingEditor } from "@/components/holdings/manual-holding-editor";
import { PositionsTable } from "@/components/holdings/positions-table";
import { HoldingsSyncButton } from "@/components/holdings/holdings-sync-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUSD } from "@/lib/formatters";
import { getDemoUserId, getHoldingsOverview } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const userId = await getDemoUserId();
  const rows = userId ? await getHoldingsOverview(userId) : [];
  const stockTotal = rows
    .filter((row) => row.assetClass === "stock")
    .reduce((sum, row) => sum + row.marketValue, 0);
  const cryptoTotal = rows
    .filter((row) => row.assetClass === "crypto")
    .reduce((sum, row) => sum + row.marketValue, 0);

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
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(stockTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crypto Total</CardTitle>
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
