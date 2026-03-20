import { headers } from "next/headers";

import { AppNav } from "@/components/shared/app-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaidConnectButton } from "@/components/connections/plaid-connect-button";
import { env } from "@/lib/env";
import { formatDateTimeEastern } from "@/lib/formatters";
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
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const requestOrigin =
    host && !host.includes("localhost") ? `${proto}://${host}` : null;
  const oauthRedirectExample = requestOrigin
    ? `${requestOrigin}/connections`
    : `${env.APP_URL.replace(/\/$/, "")}/connections`;

  const userId = await getDemoUserId();
  const rows = userId ? await getConnectionsOverview(userId) : [];
  const adapterModes = getProviderAdapterModes();
  const plaidKeysPresent = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  const providerOrder: Array<"plaid" | "snaptrade" | "coingecko"> = [
    "plaid",
    "snaptrade",
    "coingecko",
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Provider adapters are active in {env.MOCK_MODE ? "mock mode" : "real mode"}.
        </p>
        <p className="text-sm text-muted-foreground">
          Plaid status: env <span className="font-medium uppercase">{env.PLAID_ENV}</span>, adapter{" "}
          <span className="font-medium capitalize">{adapterModes.plaid}</span>, keys{" "}
          <span className="font-medium">{plaidKeysPresent ? "present" : "missing"}</span>.
        </p>
        {env.MOCK_MODE && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium">MOCK_MODE is on for this deployment.</p>
            <p className="mt-1 text-muted-foreground dark:text-amber-200/90">
              When <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">MOCK_MODE=true</code>, Plaid
              always uses the mock adapter—even if production keys are set. Set{" "}
              <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">MOCK_MODE=false</code> in Netlify
              environment variables and redeploy to use real Plaid Link and balances.
            </p>
          </div>
        )}
        {!env.MOCK_MODE && plaidKeysPresent && (
          <p className="text-xs text-muted-foreground">
            Production Plaid OAuth: add this redirect URI in the Plaid dashboard (Allowed redirect URIs):{" "}
            <code className="rounded bg-muted px-1 py-0.5">{oauthRedirectExample}</code>
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {providerOrder.map((provider) => {
          const row =
            byProvider.get(provider) ??
            ({
              id: `virtual-${provider}`,
              provider,
              displayName:
                provider === "plaid"
                  ? "Plaid - Not Connected"
                  : provider === "snaptrade"
                    ? "SnapTrade - Robinhood"
                    : "CoinGecko - Manual Crypto",
              status: "inactive",
              lastSyncedAt: null,
            } as const);
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
                    {formatDateTimeEastern(row.lastSyncedAt, "Never")}
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
