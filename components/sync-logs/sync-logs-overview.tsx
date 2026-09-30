"use client";

import { describeSyncRun } from "@/lib/sync-reporting";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { formatDateTimeEastern } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SyncRunRow = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  trigger: "manual" | "scheduled" | "system";
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  lastEvent: string | null;
  events: { message: string; createdAt: string | null }[];
};

type SyncRunsResponse = {
  runs: SyncRunRow[];
  total: number;
  page: number;
  pageSize: number;
};

async function fetchSyncRuns(page: number, pageSize: number): Promise<SyncRunsResponse> {
  const response = await fetch(`/api/sync-runs?page=${page}&pageSize=${pageSize}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Failed to load sync runs.");
  return response.json();
}

export function SyncLogsOverview() {
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const runsQuery = useQuery({
    queryKey: ["sync-runs-overview", page, pageSize],
    queryFn: () => fetchSyncRuns(page, pageSize),
    refetchInterval: 30_000,
  });

  const runs = runsQuery.data?.runs ?? [];
  const total = runsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (runsQuery.isPending) {
    return (
      <div className="wb-fade-in space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <Card className={cn("wb-card-hover")}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex gap-4 border-b pb-2">
              {["w-[22%]", "w-[14%]", "w-[12%]", "w-[22%]", "w-[30%]"].map((w, i) => (
                <Skeleton key={i} className={cn("h-3", w)} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b py-2.5">
                <Skeleton className="h-4 w-[22%]" />
                <Skeleton className="h-4 w-[14%]" />
                <Skeleton className="h-4 w-[12%]" />
                <Skeleton className="h-4 w-[22%]" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (runsQuery.isError) {
    return <p className="text-sm text-red-500">Unable to load sync logs right now.</p>;
  }

  return (
    <div className="wb-fade-in space-y-6">
      <section className="space-y-2">
        <h1 className="wb-page-title">Sync Logs</h1>
        <p className="text-sm text-muted-foreground">
          See what updated and what failed. Partially updated means some data was saved, but the sync did not finish successfully.
        </p>
      </section>

      <Card className={cn("wb-card-hover")}>
        <CardHeader>
          <CardTitle>Recent Sync Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  <th className="px-3 py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Started
                  </th>
                  <th className="px-3 py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Trigger
                  </th>
                  <th className="px-3 py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-3 py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Completed
                  </th>
                  <th className="px-3 py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Result & Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const report = describeSyncRun(run);
                  return (
                  <tr key={run.id} className="wb-table-row">
                    <td className="px-3 py-2.5 pr-4">{formatDateTimeEastern(run.startedAt)}</td>
                    <td className="px-3 py-2.5 pr-4 capitalize">{run.trigger}</td>
                    <td
                      className={cn(
                        "px-3 py-2.5 pr-4 capitalize",
                        run.status === "completed" && "text-emerald-600",
                        run.status === "failed" && (report.partial ? "text-amber-600" : "text-red-500"),
                        (run.status === "running" || run.status === "pending") && "text-amber-600"
                      )}
                    >
                      {report.label}
                    </td>
                    <td className="px-3 py-2.5 pr-4">{formatDateTimeEastern(run.completedAt)}</td>
                    <td className="min-w-72 max-w-xl px-3 py-2.5 pr-4">
                      {report.progress && <p className="mb-1">{report.progress}</p>}
                      <p className="break-words">{report.detail}</p>
                      {!!run.events?.length && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">View sync details</summary>
                          <ol className="mt-2 space-y-1 text-xs">
                            {run.events.map((event, index) => (
                              <li key={index}>
                                <span className="text-muted-foreground">{formatDateTimeEastern(event.createdAt)}</span>{" — "}{event.message}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {!runs.length && (
                  <tr className="wb-table-row">
                    <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                      No sync runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({total} total runs)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="min-w-[5.5rem]"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-w-[5.5rem]"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

