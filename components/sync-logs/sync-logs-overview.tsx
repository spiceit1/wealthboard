"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { formatDateTimeEastern } from "@/lib/formatters";
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
  });

  const runs = runsQuery.data?.runs ?? [];
  const total = runsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (runsQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (runsQuery.isError) {
    return <p className="text-sm text-red-500">Unable to load sync logs right now.</p>;
  }

  return (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sync Logs</h1>
        <p className="text-sm text-muted-foreground">
          Persisted sync run history with trigger, status, and latest event.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Trigger</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Latest Event</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b">
                    <td className="py-2 pr-4">{formatDateTimeEastern(run.startedAt)}</td>
                    <td className="py-2 pr-4 capitalize">{run.trigger}</td>
                    <td
                      className={`py-2 pr-4 capitalize ${
                        run.status === "completed"
                          ? "text-emerald-600"
                          : run.status === "failed"
                            ? "text-red-500"
                            : "text-amber-600"
                      }`}
                    >
                      {run.status}
                    </td>
                    <td className="py-2 pr-4">{formatDateTimeEastern(run.completedAt)}</td>
                    <td className="py-2 pr-4">{run.lastEvent ?? run.errorMessage ?? "-"}</td>
                  </tr>
                ))}
                {!runs.length && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={5}>
                      No sync runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({total} total runs)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

