import type { SyncDomain } from "@/lib/sync-domains";

export function domainsForRunStart(): SyncDomain[] {
  return ["dashboard", "syncRuns", "settings"];
}

export function domainsForRunFinish(trigger: "manual" | "scheduled" | "system"): SyncDomain[] {
  if (trigger === "manual") {
    return ["dashboard", "accounts", "holdings", "connections", "syncRuns", "settings"];
  }
  if (trigger === "scheduled") {
    return [
      "dashboard",
      "accounts",
      "holdings",
      "history",
      "historyDetail",
      "connections",
      "syncRuns",
      "settings",
    ];
  }
  return ["dashboard", "holdings", "connections", "syncRuns", "settings"];
}

