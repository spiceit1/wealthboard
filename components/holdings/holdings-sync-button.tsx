"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type SyncStartResponse = {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
};

type SyncProgressResponse = {
  status: "pending" | "running" | "completed" | "failed";
  events: Array<{ message: string }>;
};

export function HoldingsSyncButton() {
  const router = useRouter();
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
            router.refresh();
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
  }, [runId, router]);

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
  };

  return (
    <div className="space-y-1">
      <Button onClick={startSync} disabled={busy}>
        <RefreshCw className="mr-2 h-4 w-4" />
        {busy ? "Syncing..." : "Sync Prices Now"}
      </Button>
      {step && <p className="text-xs text-muted-foreground">{step}</p>}
    </div>
  );
}
