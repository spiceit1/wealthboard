"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { invalidateForSyncFinish, invalidateForSyncStart } from "@/lib/query-invalidation";
import { cn } from "@/lib/utils";

type SyncStartResponse = {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
};

type SyncProgressResponse = {
  status: "pending" | "running" | "completed" | "failed";
  events: Array<{ message: string }>;
};

export function HoldingsSyncButton() {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/sync/prices?runId=${runId}`, { method: "GET" });
        if (!response.ok) return;
        const data = (await response.json()) as SyncProgressResponse;
        const lastMessage = data.events[data.events.length - 1]?.message ?? null;
        if (!cancelled) setStep(lastMessage);

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(timer);
          if (!cancelled) {
            setBusy(false);
            setRunId(null);
            await invalidateForSyncFinish(queryClient, "system");
          }
        }
      } catch {
        // Keep polling; transient failures are okay.
      }
    }, 800);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [queryClient, runId]);

  const startSync = async () => {
    setBusy(true);
    setStep("Starting sync...");
    const response = await fetch("/api/sync/prices", { method: "POST" });
    if (!response.ok) {
      setBusy(false);
      setStep("Failed to start sync.");
      return;
    }
    const data = (await response.json()) as SyncStartResponse;
    setRunId(data.runId);
    await invalidateForSyncStart(queryClient);
  };

  return (
    <div className="space-y-1">
      <Button onClick={startSync} disabled={busy}>
        <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", busy && "animate-spin")} />
        {busy ? "Syncing..." : "Sync Prices Now"}
      </Button>
      {step && <p className="text-xs text-muted-foreground">{step}</p>}
    </div>
  );
}
