import { AppNav } from "@/components/shared/app-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaidConnectButton } from "@/components/connections/plaid-connect-button";
import { env } from "@/lib/env";
import { getProviderAdapterModes } from "@/providers/adapters";
import { getConnectionsOverview, getDemoUserId } from "@/services/dashboardData";

const providerSecurityNotes: Record<string, string> = {
  plaid: "Uses Plaid Link with read-only access. Credentials are never stored.",
  snaptrade: "Uses SnapTrade read-only brokerage access (no order placement).",
  coingecko: "Supports manual crypto holdings now; exchange APIs can be added later.",
};

function isProviderConfigured(provider: "plaid" | "snaptrade" | "coingecko") {
  if (env.MOCK_MODE) return true;
  const modes = getProviderAdapterModes();
  if (modes[provider] === "mock") return true;
  if (provider === "plaid") {
    return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  }
  if (provider === "snaptrade") {
    return Boolean(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY);
  }
  return true;
}

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const userId = await getDemoUserId();
  const rows = userId ? await getConnectionsOverview(userId) : [];
  const adapterModes = getProviderAdapterModes();

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Provider adapters are active in {env.MOCK_MODE ? "mock mode" : "real mode"}.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {rows.map((row) => {
          const configured = isProviderConfigured(row.provider);
          const mode = adapterModes[row.provider];
          return (
            <Card key={row.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize">{row.provider}</CardTitle>
                  <Badge variant={configured ? "secondary" : "destructive"}>
                    {mode === "mock"
                      ? "Mock Fallback"
                      : configured
                        ? "Configured"
                        : "Missing Keys"}
                  </Badge>
                </div>
                <CardDescription>{row.displayName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{providerSecurityNotes[row.provider]}</p>
                <p>
                  Status: <span className="font-medium capitalize">{row.status}</span>
                </p>
                <p>
                  Last synced:{" "}
                  <span className="font-medium">
                    {row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : "Never"}
                  </span>
                </p>
                <p>
                  Adapter mode:{" "}
                  <span className="font-medium capitalize">{mode}</span>
                </p>
                {row.provider === "plaid" && <PlaidConnectButton />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Safety Controls</CardTitle>
          <CardDescription>Integration behavior enforced by WealthBoard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>- All integrations are read-only.</p>
          <p>- No financial transaction endpoints exist.</p>
          <p>- Provider secrets are server-side environment variables only.</p>
          <p>- Bank usernames/passwords are never stored.</p>
        </CardContent>
      </Card>
    </main>
  );
}
