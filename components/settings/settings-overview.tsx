"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeEastern } from "@/lib/formatters";

type SettingsData = {
  latestScheduled: {
    status: "pending" | "running" | "completed" | "failed";
    startedAt: string;
  } | null;
  latestManual: {
    status: "pending" | "running" | "completed" | "failed";
  } | null;
  nextExpectedNyNine: string | null;
} | null;

type SettingsResponse = {
  data: SettingsData;
  mockMode: boolean;
  internalTokenSet: boolean;
};

async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch("/api/settings", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load settings.");
  return response.json();
}

export function SettingsOverview() {
  const settingsQuery = useQuery({
    queryKey: ["settings-overview"],
    queryFn: fetchSettings,
  });

  if (settingsQuery.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scheduler</CardTitle>
            <CardDescription>Daily auto-refresh target: 9:00 AM America/New_York.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Server-side runtime flags and protections.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return <p className="text-sm text-red-500">Unable to load settings right now.</p>;
  }

  const { data, mockMode, internalTokenSet } = settingsQuery.data;

  return (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Scheduler health, security controls, and runtime mode.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scheduler</CardTitle>
            <CardDescription>Daily auto-refresh target: 9:00 AM America/New_York.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Latest scheduled run:{" "}
              <span className="font-medium capitalize">{data?.latestScheduled?.status ?? "none"}</span>
            </p>
            <p>
              Started at:{" "}
              <span className="font-medium">{formatDateTimeEastern(data?.latestScheduled?.startedAt)}</span>
            </p>
            <p>
              Next expected run (NY):{" "}
              <span className="font-medium">{formatDateTimeEastern(data?.nextExpectedNyNine)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Server-side runtime flags and protections.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Mode: <span className="font-medium">{mockMode ? "Mock" : "Real"}</span>
            </p>
            <p>
              Internal token set: <span className="font-medium">{internalTokenSet ? "Yes" : "No"}</span>
            </p>
            <p>
              Latest manual run:{" "}
              <span className="font-medium capitalize">{data?.latestManual?.status ?? "none"}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

