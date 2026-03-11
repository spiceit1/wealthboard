import { AppNav } from "@/components/shared/app-nav";
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
          Brokerage positions and crypto holdings with quantity, price, and market value.
        </p>
      </section>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Symbol</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Asset Class</th>
                  <th className="py-2 pr-4">Quantity</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-4">{row.symbol}</td>
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 capitalize">{row.assetClass}</td>
                    <td className="py-2 pr-4">{row.quantity.toFixed(6)}</td>
                    <td className="py-2 pr-4">{formatUSD(row.lastPrice)}</td>
                    <td className="py-2 pr-4">{formatUSD(row.marketValue)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={6}>
                      No holdings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
