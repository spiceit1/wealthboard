import type { QueryClient } from "@tanstack/react-query";
import type { SyncDomain } from "@/lib/sync-domains";

type SyncTrigger = "manual" | "scheduled" | "system";

const keys = {
  dashboard: ["dashboard"] as const,
  accounts: ["accounts-overview"] as const,
  holdings: ["holdings-overview"] as const,
  history: ["history-overview"] as const,
  historyDetail: ["history-detail"] as const,
  connections: ["connections-overview"] as const,
  syncRuns: ["sync-runs-overview"] as const,
  settings: ["settings-overview"] as const,
};

export function queryKeysForDomains(domains: ReadonlyArray<SyncDomain>): ReadonlyArray<readonly unknown[]> {
  const resolved: Array<readonly unknown[]> = [];
  for (const domain of domains) {
    resolved.push(keys[domain]);
  }
  return resolved;
}

async function invalidateList(queryClient: QueryClient, list: ReadonlyArray<readonly unknown[]>) {
  await Promise.all(
    list.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
      }),
    ),
  );
}

export async function invalidateByDomains(
  queryClient: QueryClient,
  domains: ReadonlyArray<SyncDomain>,
) {
  const queryKeys = queryKeysForDomains(domains).filter((queryKey, index, all) => {
    const serialized = JSON.stringify(queryKey);
    return all.findIndex((item) => JSON.stringify(item) === serialized) === index;
  });
  await invalidateList(queryClient, queryKeys);
}

export async function invalidateForSyncStart(queryClient: QueryClient) {
  await invalidateByDomains(queryClient, ["dashboard", "syncRuns", "settings"]);
}

export async function invalidateForSyncFinish(queryClient: QueryClient, trigger: SyncTrigger) {
  if (trigger === "manual") {
    await invalidateByDomains(queryClient, [
      "dashboard",
      "accounts",
      "holdings",
      "connections",
      "syncRuns",
      "settings",
    ]);
    return;
  }

  if (trigger === "scheduled") {
    await invalidateByDomains(queryClient, [
      "dashboard",
      "accounts",
      "holdings",
      "history",
      "historyDetail",
      "connections",
      "syncRuns",
      "settings",
    ]);
    return;
  }

  await invalidateByDomains(queryClient, [
    "dashboard",
    "holdings",
    "connections",
    "syncRuns",
    "settings",
  ]);
}

export async function invalidateForManualHoldingChange(queryClient: QueryClient) {
  await invalidateByDomains(queryClient, ["holdings", "dashboard"]);
}

export async function invalidateForPlaidConnectionChange(queryClient: QueryClient) {
  await invalidateByDomains(queryClient, ["connections", "accounts", "dashboard"]);
}

