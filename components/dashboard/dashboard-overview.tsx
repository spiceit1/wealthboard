"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";

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
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  events: Array<{ timestamp: string; message: string }>;
  summary: {
    cash: number;
    stocks: number;
    crypto: number;
    total: number;
  } | null;
};

type SyncStartResponse = {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  started: boolean;
};

type DashboardResponse = {
  summary: {
    date: string;
    cash: number;
    stocks: number;
    crypto: number;
    total: number;
    dailyChange: number;
  } | null;
  history: Array<{
    id: string;
    date: string;
    cash: number;
    stocks: number;
    crypto: number;
    total: number;
    dailyChange: number;
  }>;
  latestSync: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  } | null;
  events: Array<{
    message: string;
    timestamp: string;
    level: "info" | "warning" | "error";
  }>;
};

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function tooltipCurrency(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return formatUSD(numeric);
}

async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch("/api/dashboard", { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch dashboard data.");
  return response.json();
}

async function startManualSync(): Promise<SyncStartResponse> {
  const response = await fetch("/api/sync", { method: "POST" });
  if (!response.ok) throw new Error("Failed to start manual sync.");
  return response.json();
}

async function fetchSyncProgress(runId: string): Promise<SyncResponse> {
  const response = await fetch(`/api/sync?runId=${runId}`, { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch sync progress.");
  return response.json();
}

export function DashboardOverview() {
  const [range, setRange] = useState<"7D" | "30D" | "90D" | "1Y" | "All">("30D");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  const syncMutation = useMutation({
    mutationFn: startManualSync,
    onSuccess: (data) => {
      setActiveRunId(data.runId);
    },
  });

  const syncProgressQuery = useQuery({
    queryKey: ["sync-progress", activeRunId],
    queryFn: () => fetchSyncProgress(activeRunId as string),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 700 : false;
    },
  });

  useEffect(() => {
    const status = syncProgressQuery.data?.status;
    if (status === "completed" || status === "failed") {
      void dashboardQuery.refetch();
    }
  }, [dashboardQuery, syncProgressQuery.data?.status]);

  const filteredHistory = useMemo(() => {
    const rows = dashboardQuery.data?.history ?? [];
    if (range === "All") return rows;
    const limit = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
    return rows.slice(Math.max(0, rows.length - limit));
  }, [dashboardQuery.data?.history, range]);

  const allocationData = useMemo(() => {
    const summary = dashboardQuery.data?.summary;
    if (!summary) return [];
    return [
      { name: "Cash", value: summary.cash, color: "#3b82f6" },
      { name: "Stocks", value: summary.stocks, color: "#10b981" },
      { name: "Crypto", value: summary.crypto, color: "#a855f7" },
    ];
  }, [dashboardQuery.data?.summary]);

  const activeSummary = syncProgressQuery.data?.summary ?? dashboardQuery.data?.summary;
  const activeEvents =
    syncProgressQuery.data?.events ??
    dashboardQuery.data?.events?.map((event) => ({
      timestamp: event.timestamp,
      message: event.message,
    })) ??
    [];
  const isSyncing =
    syncMutation.isPending ||
    syncProgressQuery.data?.status === "running" ||
    syncProgressQuery.data?.status === "pending";
  const runningProviderMessage = activeEvents[activeEvents.length - 1]?.message ?? "Idle";

  const isLoading = dashboardQuery.isPending;
  const hasError = dashboardQuery.isError;

  if (isLoading) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">WealthBoard Dashboard</h1>
        <p className="text-sm text-muted-foreground">Loading seeded financial snapshots...</p>
      </section>
    );
  }

  if (hasError) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">WealthBoard Dashboard</h1>
        <p className="text-sm text-red-500">
          Unable to load dashboard data. Run `npm run db:push` and `npm run db:seed`, then
          refresh.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WealthBoard Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Database-backed snapshots with mock providers and chart-ready history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Mock Mode</Badge>
          <Button onClick={() => syncMutation.mutate()} disabled={isSyncing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isSyncing ? "Syncing..." : "Get My Latest Info"}
          </Button>
        </div>
      </div>
      {isSyncing && (
        <p className="text-sm text-muted-foreground">Current step: {runningProviderMessage}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Net Worth</CardDescription>
            <CardTitle>{formatUSD(activeSummary?.total ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cash</CardDescription>
            <CardTitle>{formatUSD(activeSummary?.cash ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Stocks</CardDescription>
            <CardTitle>{formatUSD(activeSummary?.stocks ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Crypto</CardDescription>
            <CardTitle>{formatUSD(activeSummary?.crypto ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Net Worth Trend</CardTitle>
                <CardDescription>Daily total net worth snapshots</CardDescription>
              </div>
              <div className="flex gap-1">
                {(["7D", "30D", "90D", "1Y", "All"] as const).map((option) => (
                  <Button
                    key={option}
                    variant={range === option ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRange(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredHistory}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(value) => tooltipCurrency(value)}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>Cash vs stocks vs crypto</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(value) => tooltipCurrency(value)} />
                <Pie
                  data={allocationData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                >
                  {allocationData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Trends</CardTitle>
          <CardDescription>Cash, stocks, and crypto over time</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredHistory}>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value) => tooltipCurrency(value)}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="cash"
                name="Cash"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="stocks"
                name="Stocks"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.16}
              />
              <Area
                type="monotone"
                dataKey="crypto"
                name="Crypto"
                stroke="#a855f7"
                fill="#a855f7"
                fillOpacity={0.12}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Sync Activity</CardTitle>
          <CardDescription>Most recent provider event sequence.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {activeEvents.map((event) => (
              <li key={`${event.timestamp}-${event.message}`} className="text-muted-foreground">
                [{new Date(event.timestamp).toLocaleTimeString()}] {event.message}
              </li>
            ))}
            {!activeEvents.length && (
              <li className="text-muted-foreground">Run sync to view activity logs.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
