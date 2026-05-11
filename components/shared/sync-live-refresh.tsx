"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateByDomains, invalidateForSyncFinish, invalidateForSyncStart } from "@/lib/query-invalidation";
import type { SyncDomain } from "@/lib/sync-domains";

type LatestSyncRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  trigger: "manual" | "scheduled" | "system";
  startedAt: string;
  completedAt: string | null;
} | null;

type LatestSyncResponse = {
  latest: LatestSyncRun;
  affectedDomains?: SyncDomain[];
};

type LiveStatusDetail = {
  state: "connecting" | "healthy" | "degraded";
  via: "sse" | "poll";
  retryInMs?: number;
};

function publishStatus(detail: LiveStatusDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wealthboard:live-status", { detail }));
}

export function SyncLiveRefresh() {
  const queryClient = useQueryClient();
  const previousRef = useRef<LatestSyncRun>(null);

  useEffect(() => {
    const STEADY_POLL_MS = 60_000;
    const MAX_RETRY_MS = 300_000;
    const HIDDEN_POLL_MS = 300_000;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let failureCount = 0;
    const clearPoll = () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const handleLatest = async (payload: LatestSyncResponse) => {
      const latest = payload.latest;
      const previous = previousRef.current;

      if (!previous) {
        previousRef.current = latest;
        return;
      }

      const newRunStarted = latest?.id && latest.id !== previous.id;
      const sameRunCompleted =
        latest?.id === previous.id &&
        latest.status !== previous.status &&
        (latest.status === "completed" || latest.status === "failed");

      if (newRunStarted) {
        if (payload.affectedDomains?.length) {
          await invalidateByDomains(queryClient, payload.affectedDomains);
        } else {
          await invalidateForSyncStart(queryClient);
        }
      }

      if (sameRunCompleted && latest?.trigger) {
        if (payload.affectedDomains?.length) {
          await invalidateByDomains(queryClient, payload.affectedDomains);
        } else {
          await invalidateForSyncFinish(queryClient, latest.trigger);
        }
      }

      previousRef.current = latest;
    };

    const pollOnce = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        publishStatus({ state: "healthy", via: "poll" });
        pollTimer = setTimeout(() => void pollOnce(), HIDDEN_POLL_MS);
        return;
      }

      let nextDelay = STEADY_POLL_MS;
      try {
        const response = await fetch("/api/sync/latest", { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("poll request failed");
        const payload = (await response.json()) as LatestSyncResponse;
        await handleLatest(payload);
        failureCount = 0;
        publishStatus({ state: "healthy", via: "poll" });
      } catch {
        failureCount += 1;
        const retryInMs = Math.min(MAX_RETRY_MS, 30_000 * 2 ** Math.min(failureCount, 4));
        nextDelay = retryInMs;
        publishStatus({ state: "degraded", via: "poll", retryInMs });
      }
      pollTimer = setTimeout(() => void pollOnce(), nextDelay);
    };

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        clearPoll();
        void pollOnce();
      }
    };

    publishStatus({ state: "connecting", via: "poll" });
    void pollOnce();
    window.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [queryClient]);

  return null;
}

