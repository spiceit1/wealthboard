"use client";

import { useQuery } from "@tanstack/react-query";

import { PlaidConnectButton } from "@/components/connections/plaid-connect-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeEastern } from "@/lib/formatters";

const providerSecurityNotes: Record<string, string> = {
  plaid: "Uses Plaid Link with read-only access. Credentials are never stored.",
  snaptrade:
    "Stock prices are refreshed from Stooq during manual sync, every 15 minutes on weekdays during market hours (09:30-16:00 ET), and the daily 9:00 AM America/New_York scheduled sync. Quantities are entered manually in Holdings.",
  coingecko:
    "Crypto prices are refreshed from CoinGecko during manual sync, every 15 minutes on weekdays during market hours (09:30-16:00 ET), and the daily 9:00 AM America/New_York scheduled sync. Quantities are entered manually in Holdings.",
};

const providerSyncMethod: Record<string, string> = {
  plaid: "Pulls live bank balances from Plaid-linked accounts.",
  snaptrade: "Price source for manual stocks: Stooq (no position import).",
  coingecko: "Price source for manual crypto: CoinGecko API.",
};

type ConnectionRow = {
  id: string;
  provider: "plaid" | "snaptrade" | "coingecko";
  displayName: string;
  status: "active" | "inactive" | "error";
  lastSyncedAt: string | null;
};

type ConnectionsResponse = {
  rows: ConnectionRow[];
  adapterModes: Record<"plaid" | "snaptrade" | "coingecko", "real" | "mock">;
  plaidKeysPresent: boolean;
  mockMode: boolean;
  plaidEnv: string;
  oauthRedirectExample: string;
};

async function fetchConnections(): Promise<ConnectionsResponse> {
  const response = await fetch("/api/connections", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load connection overview.");
  return response.json();
}

export function ConnectionsOverview() {
  const query = useQuery({
    queryKey: ["connections-overview"],
    queryFn: fetchConnections,
  });

  if (query.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Plaid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-9 w-36" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Snaptrade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coingecko</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <p className="text-sm text-red-500">Unable to load connection data right now.</p>;
  }

  const { rows, adapterModes, mockMode, plaidEnv, plaidKeysPresent, oauthRedirectExample } = query.data;
  const providerOrder: Array<"plaid" | "snaptrade" | "coingecko"> = ["plaid", "snaptrade", "coingecko"];

  return (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Provider adapters are active in {mockMode ? "mock mode" : "real mode"}.
        </p>
        <p className="text-sm text-muted-foreground">
          Plaid status: env <span className="font-medium uppercase">{plaidEnv}</span>, adapter{" "}
          <span className="font-medium capitalize">{adapterModes.plaid}</span>, keys{" "}
          <span className="font-medium">{plaidKeysPresent ? "present" : "missing"}</span>.
        </p>
        {mockMode && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium">MOCK_MODE is on for this deployment.</p>
            <p className="mt-1 text-muted-foreground dark:text-amber-200/90">
              When <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">MOCK_MODE=true</code>, Plaid
              always uses the mock adapter-even if production keys are set. Set{" "}
              <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">MOCK_MODE=false</code> in Netlify
              environment variables and redeploy to use real Plaid Link and balances.
            </p>
          </div>
        )}
        {!mockMode && plaidKeysPresent && (
          <p className="text-xs text-muted-foreground">
            Production Plaid OAuth: add this redirect URI in the Plaid dashboard (Allowed redirect URIs):{" "}
            <code className="rounded bg-muted px-1 py-0.5">{oauthRedirectExample}</code>
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {providerOrder.map((provider) => {
          const providerRows = rows
            .filter((row) => row.provider === provider)
            .sort((a, b) => {
              const aTime = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
              const bTime = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
              return bTime - aTime;
            });
          const row =
            providerRows[0] ??
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
          const activeCount = providerRows.filter((item) => item.status === "active").length;
          const mode = adapterModes[row.provider];
          const badge: { variant: "secondary" | "destructive"; label: string } = (() => {
            if (row.provider === "snaptrade") {
              return { variant: "secondary", label: "Auto Prices (Manual Holdings)" };
            }
            if (row.provider === "coingecko") {
              return {
                variant: "secondary",
                label: mode === "real" ? "Live Prices" : "Mock Prices",
              };
            }
            return {
              variant: plaidKeysPresent ? "secondary" : "destructive",
              label: mode === "mock" ? "Mock Fallback" : plaidKeysPresent ? "Configured" : "Missing Keys",
            };
          })();
          return (
            <Card key={row.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize">{row.provider}</CardTitle>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <CardDescription>
                  {row.provider === "plaid" && providerRows.length > 0
                    ? `${providerRows.length} linked institution${providerRows.length === 1 ? "" : "s"}`
                    : row.displayName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{providerSecurityNotes[row.provider]}</p>
                <p className="text-muted-foreground">{providerSyncMethod[row.provider]}</p>
                <p>
                  Status:{" "}
                  <span className="font-medium capitalize">
                    {row.provider === "plaid" && providerRows.length > 0
                      ? `${activeCount}/${providerRows.length} active`
                      : row.status}
                  </span>
                </p>
                <p>
                  Last synced:{" "}
                  <span className="font-medium">{formatDateTimeEastern(row.lastSyncedAt, "Never")}</span>
                </p>
                <p>
                  Price sync mode:{" "}
                  <span className="font-medium capitalize">
                    {row.provider === "plaid" ? mode : "manual holdings + live prices"}
                  </span>
                </p>
                {row.provider === "plaid" && providerRows.length > 0 && (
                  <div className="space-y-1 rounded-md border p-2">
                    <p className="text-xs font-medium text-muted-foreground">Linked Plaid institutions</p>
                    {providerRows.map((item) => (
                      <p key={item.id} className="text-xs">
                        <span className="font-medium">{item.displayName}</span>{" "}
                        <span className="text-muted-foreground">
                          ({item.status}, {formatDateTimeEastern(item.lastSyncedAt, "never synced")})
                        </span>
                      </p>
                    ))}
                  </div>
                )}
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
    </>
  );
}

