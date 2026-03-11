import { AppNav } from "@/components/shared/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUSD } from "@/lib/formatters";
import { getAccountsOverview, getDemoUserId } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const userId = await getDemoUserId();
  const rows = userId ? await getAccountsOverview(userId) : [];
  const cashTotal = rows
    .filter((row) => row.type === "checking" || row.type === "savings")
    .reduce((sum, row) => sum + row.balance, 0);
  const brokerageTotal = rows
    .filter((row) => row.type === "brokerage")
    .reduce((sum, row) => sum + row.balance, 0);
  const cryptoWalletTotal = rows
    .filter((row) => row.type === "crypto_wallet")
    .reduce((sum, row) => sum + row.balance, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Drill-down of connected cash, brokerage, and crypto wallet accounts.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash Accounts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(cashTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brokerage Accounts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(brokerageTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crypto Wallets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(cryptoWalletTotal)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Institution</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Balance</th>
                  <th className="py-2 pr-4">As Of</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-4">{row.institutionName}</td>
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 capitalize">{row.type.replace("_", " ")}</td>
                    <td className="py-2 pr-4">{formatUSD(row.balance)}</td>
                    <td className="py-2 pr-4">
                      {row.balanceAsOf ? new Date(row.balanceAsOf).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={5}>
                      No accounts found.
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
