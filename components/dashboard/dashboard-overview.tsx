"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SyncResponse = {
  status: "completed" | "failed";
  events: Array<{ timestamp: string; message: string }>;
  summary: {
    cash: number;
    stocks: number;
    crypto: number;
    total: number;
  };
};

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

async function fetchSyncSnapshot(): Promise<SyncResponse> {
  const response = await fetch("/api/sync", { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch sync snapshot.");
  return response.json();
}

async function runManualSync(): Promise<SyncResponse> {
  const response = await fetch("/api/sync", { method: "POST" });
  if (!response.ok) throw new Error("Failed to run manual sync.");
  return response.json();
}

export function DashboardOverview() {
  const syncQuery = useQuery({
    queryKey: ["sync-snapshot"],
    queryFn: fetchSyncSnapshot,
  });

  const syncMutation = useMutation({
    mutationFn: runManualSync,
    onSuccess: (data) => {
      syncQuery.refetch();
      return data;
    },
  });

  const data = syncMutation.data ?? syncQuery.data;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WealthBoard Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Phase 1 foundation with mock-mode data and sync scaffolding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Mock Mode</Badge>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Get My Latest Info
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Net Worth</CardDescription>
            <CardTitle>{formatUSD(data?.summary.total ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cash</CardDescription>
            <CardTitle>{formatUSD(data?.summary.cash ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Stocks</CardDescription>
            <CardTitle>{formatUSD(data?.summary.stocks ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Crypto</CardDescription>
            <CardTitle>{formatUSD(data?.summary.crypto ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Sync Activity</CardTitle>
          <CardDescription>Real-time style event list from the current sync result.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(data?.events ?? []).map((event) => (
              <li key={`${event.timestamp}-${event.message}`} className="text-muted-foreground">
                [{new Date(event.timestamp).toLocaleTimeString()}] {event.message}
              </li>
            ))}
            {!data?.events?.length && (
              <li className="text-muted-foreground">Run sync to view activity logs.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
