import Link from "next/link";

import { AppNav } from "@/components/shared/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUSD } from "@/lib/formatters";
import { getDemoUserId, getHistoryRows } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const userId = await getDemoUserId();
  const rows = userId ? await getHistoryRows(userId) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Daily net worth snapshots from seeded data.</p>
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
                      <td
                        className={`py-2 pr-4 ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {change >= 0 ? "+" : ""}
                        {formatUSD(change)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
