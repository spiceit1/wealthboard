"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
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
import { useEffect, useMemo, useRef, useState } from "react";

import { formatDateTimeEastern, formatTimeEastern } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RelativeTime } from "@/components/shared/relative-time";
import { cn } from "@/lib/utils";
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
    asOf?: string | null;
    cashAsOf?: string | null;
    stocksAsOf?: string | null;
    cryptoAsOf?: string | null;
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
    changeSinceLabel?: string;
    changeSinceAt?: string | null;
    asOf: string | null;
    cashAsOf: string | null;
    stocksAsOf: string | null;
    cryptoAsOf: string | null;
  } | null;
  history: Array<{
    id: string;
    date: string;
    capturedAt?: string | null;
    cash: number;
    stocks: number;
    crypto: number;
    total: number;
    dailyChange: number;
  }>;
  intradayHistory: Array<{
    id: string;
    date: string;
    capturedAt?: string | null;
    cash: number;
    stocks: number;
    crypto: number;
    total: number;
    dailyChange: number;
  }>;
  latestIntradaySyncAt: string | null;
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
  mockMode: boolean;
};

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function tooltipCurrency(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return formatUSD(numeric);
}

function IntradayTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { capturedAt?: string | null; total: number; cash: number; stocks: number; crypto: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 text-muted-foreground">
        {row.capturedAt ? formatDateTimeEastern(row.capturedAt) : "Intraday point"}
      </p>
      <p className="font-medium">Total: {formatUSD(row.total)}</p>
      <p className="text-muted-foreground">Cash: {formatUSD(row.cash)}</p>
      <p className="text-muted-foreground">Stocks: {formatUSD(row.stocks)}</p>
      <p className="text-muted-foreground">Crypto: {formatUSD(row.crypto)}</p>
    </div>
  );
}

async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch("/api/dashboard", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch dashboard data.");
  return response.json();
}

async function startManualSync(): Promise<SyncStartResponse> {
  const response = await fetch("/api/sync", { method: "POST" });
  if (!response.ok) throw new Error("Failed to start manual sync.");
  return response.json();
}

async function fetchSyncProgress(runId: string): Promise<SyncResponse> {
  const response = await fetch(`/api/sync?runId=${runId}`, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch sync progress.");
  return response.json();
}

const CHART_COLORS = {
  cash: "#3b82f6",
  stocks: "#10b981",
  crypto: "#a855f7",
  line: "#2563eb",
};

export function DashboardOverview() {
  const [range, setRange] = useState<"1D" | "7D" | "30D" | "90D" | "1Y" | "All">("1D");
  const [intradayMode, setIntradayMode] = useState<"total" | "breakdown">("total");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [summaryPulse, setSummaryPulse] = useState(false);
  const previousAsOfRef = useRef<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
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

  const activeSummary = syncProgressQuery.data?.summary ?? dashboardQuery.data?.summary;

  useEffect(() => {
    const status = syncProgressQuery.data?.status;
    if (status === "completed" || status === "failed") {
      void dashboardQuery.refetch();
    }
  }, [dashboardQuery, syncProgressQuery.data?.status]);

  useEffect(() => {
    const nextAsOf = activeSummary?.asOf ?? null;
    if (!nextAsOf) return;
    if (previousAsOfRef.current == null) {
      previousAsOfRef.current = nextAsOf;
      return;
    }
    if (previousAsOfRef.current !== nextAsOf) {
      setSummaryPulse(true);
      const timer = setTimeout(() => setSummaryPulse(false), 1800);
      previousAsOfRef.current = nextAsOf;
      return () => clearTimeout(timer);
    }
  }, [activeSummary?.asOf]);

  const filteredHistory = useMemo(() => {
    const dailyRows = dashboardQuery.data?.history ?? [];
    const intradayRows = dashboardQuery.data?.intradayHistory ?? [];
    if (range === "1D" && intradayRows.length > 0) return intradayRows;
    const rows = dailyRows;
    if (range === "All") return rows;
    const limit =
      range === "1D" ? 1 : range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
    return rows.slice(Math.max(0, rows.length - limit));
  }, [dashboardQuery.data?.history, dashboardQuery.data?.intradayHistory, range]);

  const allocationData = useMemo(() => {
    const summary = dashboardQuery.data?.summary;
    if (!summary) return [];
    return [
      { name: "Cash", value: summary.cash, color: CHART_COLORS.cash },
      { name: "Stocks", value: summary.stocks, color: CHART_COLORS.stocks },
      { name: "Crypto", value: summary.crypto, color: CHART_COLORS.crypto },
    ];
  }, [dashboardQuery.data?.summary]);

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
  const hasSinglePointTrend = filteredHistory.length <= 1;
  const usingIntradayRange = range === "1D" && (dashboardQuery.data?.intradayHistory?.length ?? 0) > 0;
  const intradayChartData = useMemo(
    () =>
      filteredHistory.map((row) => ({
        ...row,
        chartTs: row.capturedAt ? new Date(row.capturedAt).getTime() : Number.NaN,
      })),
    [filteredHistory],
  );

  const marketWindowState = (() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
    const inWindow =
      isWeekday &&
      (hour > 9 || (hour === 9 && minute >= 0)) &&
      (hour < 16 || (hour === 16 && minute === 0));
    return { inWindow };
  })();

  const dailyChange = dashboardQuery.data?.summary?.dailyChange ?? 0;
  const changeSinceLabel = dashboardQuery.data?.summary?.changeSinceLabel ?? "since latest snapshot";
  const changeIsPositive = dailyChange >= 0;

  if (dashboardQuery.isPending) {
    return (
      <section className="space-y-6 wb-fade-in">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="wb-card-hover">
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-3 w-32" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3"><CardContent className="pt-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          <Card className="lg:col-span-2"><CardContent className="pt-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
      </section>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <section className="space-y-4">
        <h1 className="wb-page-title">Dashboard</h1>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Unable to load dashboard data. Run <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:push</code> and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:seed</code>, then refresh.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6 wb-fade-in">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight tabular-nums">
              {formatUSD(activeSummary?.total ?? 0)}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                changeIsPositive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700",
              )}
            >
              {changeIsPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {changeIsPositive ? "+" : ""}
              {formatUSD(dailyChange)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Total net worth</p>
          <p className="text-xs text-muted-foreground capitalize">
            {changeIsPositive ? "Up" : "Down"} {formatUSD(Math.abs(dailyChange))} {changeSinceLabel}
          </p>
          {activeSummary?.asOf && (
            <p className="text-xs text-muted-foreground">
              Updated {formatDateTimeEastern(activeSummary.asOf)} (<RelativeTime value={activeSummary.asOf} />)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={dashboardQuery.data?.mockMode ? "secondary" : "outline"}>
            {dashboardQuery.data?.mockMode ? "Mock" : "Live"}
          </Badge>
          <Button onClick={() => syncMutation.mutate()} disabled={isSyncing} size="sm">
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      {isSyncing && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-primary">
          <span className="font-medium">Syncing:</span> {runningProviderMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Net Worth", value: activeSummary?.total ?? 0, asOf: activeSummary?.asOf },
          { label: "Cash", value: activeSummary?.cash ?? 0, asOf: activeSummary?.cashAsOf },
          { label: "Stocks", value: activeSummary?.stocks ?? 0, asOf: activeSummary?.stocksAsOf },
          { label: "Crypto", value: activeSummary?.crypto ?? 0, asOf: activeSummary?.cryptoAsOf },
        ].map((kpi) => (
          <Card
            key={kpi.label}
            className={cn("wb-card-hover", summaryPulse && "wb-pulse-highlight")}
          >
            <CardHeader>
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                {kpi.label}
              </CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatUSD(kpi.value)}</CardTitle>
              {kpi.asOf && (
                <p className="text-[11px] text-muted-foreground">
                  <RelativeTime value={kpi.asOf} />
                </p>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 wb-card-hover">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="wb-section-title">Net Worth Trend</CardTitle>
                <CardDescription>
                  {usingIntradayRange
                    ? "15-minute intraday snapshots"
                    : "Daily snapshots (as of ~9:00 AM ET)"}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                  {(["1D", "7D", "30D", "90D", "1Y", "All"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setRange(option)}
                      aria-pressed={range === option}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        range === option
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {usingIntradayRange && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                      {(["total", "breakdown"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setIntradayMode(mode)}
                          aria-pressed={intradayMode === mode}
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            intradayMode === mode
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {mode === "total" ? "Net Worth" : "Cash/Stocks/Crypto"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Last 15m sync:{" "}
                      {dashboardQuery.data?.latestIntradaySyncAt
                        ? formatDateTimeEastern(dashboardQuery.data.latestIntradaySyncAt)
                        : "none yet"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          {usingIntradayRange && !marketWindowState.inWindow && (
            <CardContent className="pt-0">
              <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Market window closed (09:00-16:00 ET). New intraday points resume at next window.
              </div>
            </CardContent>
          )}
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {usingIntradayRange ? (
                <LineChart data={intradayChartData}>
                  <XAxis
                    dataKey="chartTs"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) =>
                      new Intl.DateTimeFormat("en-US", {
                        timeZone: "America/New_York",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }).format(new Date(Number(value)))
                    }
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    minTickGap={28}
                  />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as
                        | { capturedAt?: string | null; date?: string }
                        | undefined;
                      if (row?.capturedAt) {
                        return `Time: ${formatDateTimeEastern(row.capturedAt)}`;
                      }
                      return "Time";
                    }}
                    formatter={(value) => tooltipCurrency(value)}
                    content={intradayMode === "total" ? <IntradayTooltipContent /> : undefined}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "12px",
                    }}
                  />
                  {intradayMode === "total" ? (
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="total"
                      stroke={CHART_COLORS.line}
                      strokeWidth={2}
                      dot={hasSinglePointTrend ? { r: 4, strokeWidth: 2, fill: "#fff" } : false}
                      activeDot={{ r: 5 }}
                    />
                  ) : (
                    <>
                      <Line type="monotone" dataKey="cash" name="cash" stroke={CHART_COLORS.cash} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="stocks" name="stocks" stroke={CHART_COLORS.stocks} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="crypto" name="crypto" stroke={CHART_COLORS.crypto} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </>
                  )}
                </LineChart>
              ) : (
                <LineChart data={filteredHistory}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    formatter={(value) => tooltipCurrency(value)}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as
                        | { capturedAt?: string | null; date?: string }
                        | undefined;
                      if (row?.capturedAt) {
                        return `Time: ${formatDateTimeEastern(row.capturedAt)}`;
                      }
                      return `Date: ${label}`;
                    }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={CHART_COLORS.line}
                    strokeWidth={2}
                    dot={hasSinglePointTrend ? { r: 4, strokeWidth: 2, fill: "#fff" } : false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
            {hasSinglePointTrend && (
              <p className="mt-2 text-xs text-muted-foreground">
                {usingIntradayRange
                  ? "Single intraday snapshot available for this range."
                  : "Single daily snapshot available for this range."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 wb-card-hover">
          <CardHeader>
            <CardTitle className="wb-section-title">Asset Allocation</CardTitle>
            <CardDescription>Distribution by asset class</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(value) => tooltipCurrency(value)}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                  }}
                />
                <Pie
                  data={allocationData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  strokeWidth={2}
                  stroke="var(--background)"
                >
                  {allocationData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Trends */}
      <Card className="wb-card-hover">
        <CardHeader>
          <CardTitle className="wb-section-title">Category Trends</CardTitle>
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
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "12px",
                }}
              />
              <Legend iconType="circle" iconSize={8} />
              <Area
                type="monotone"
                dataKey="cash"
                name="Cash"
                stroke={CHART_COLORS.cash}
                fill={CHART_COLORS.cash}
                fillOpacity={0.15}
                strokeWidth={1.5}
                dot={hasSinglePointTrend ? { r: 3 } : false}
              />
              <Area
                type="monotone"
                dataKey="stocks"
                name="Stocks"
                stroke={CHART_COLORS.stocks}
                fill={CHART_COLORS.stocks}
                fillOpacity={0.12}
                strokeWidth={1.5}
                dot={hasSinglePointTrend ? { r: 3 } : false}
              />
              <Area
                type="monotone"
                dataKey="crypto"
                name="Crypto"
                stroke={CHART_COLORS.crypto}
                fill={CHART_COLORS.crypto}
                fillOpacity={0.1}
                strokeWidth={1.5}
                dot={hasSinglePointTrend ? { r: 3 } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
          {hasSinglePointTrend && (
            <p className="mt-2 text-xs text-muted-foreground">
              {usingIntradayRange
                ? "Add more intraday snapshots to view a trend line."
                : "Add more daily snapshots to view a trend line."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sync Activity */}
      <Card className="wb-card-hover">
        <CardHeader>
          <CardTitle className="wb-section-title">Latest Sync Activity</CardTitle>
          <CardDescription>Most recent provider event sequence</CardDescription>
        </CardHeader>
        <CardContent>
          {activeEvents.length ? (
            <div className="space-y-1.5">
              {activeEvents.map((event) => (
                <div
                  key={`${event.timestamp}-${event.message}`}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatTimeEastern(event.timestamp)}
                  </span>
                  <span className="text-foreground/80">{event.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run a sync to view activity logs.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
