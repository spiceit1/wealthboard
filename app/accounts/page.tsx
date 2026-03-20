import { AppNav } from "@/components/shared/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeEastern, formatUSD } from "@/lib/formatters";
import { getAccountsOverview, getDemoUserId } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const userId = await getDemoUserId();
  const rows = userId ? await getAccountsOverview(userId) : [];
  const bankRows = rows.filter((row) => row.type === "checking" || row.type === "savings");
  const cashTotal = bankRows
    .filter((row) => row.type === "checking" || row.type === "savings")
    .reduce((sum, row) => sum + row.balance, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Connected bank cash accounts (checking and savings).
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bank Cash Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatUSD(cashTotal)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank Account Balances</CardTitle>
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
                {bankRows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-4">{row.institutionName}</td>
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 capitalize">{row.type.replace("_", " ")}</td>
                    <td className="py-2 pr-4">{formatUSD(row.balance)}</td>
                    <td className="py-2 pr-4">
                      {formatDateTimeEastern(row.balanceAsOf)}
                    </td>
                  </tr>
                ))}
                {!bankRows.length && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={5}>
                      No bank accounts found.
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
