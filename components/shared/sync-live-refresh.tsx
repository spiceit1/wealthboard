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
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let eventSource: EventSource | null = null;
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
      try {
        const response = await fetch("/api/sync/latest", { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("poll request failed");
        const payload = (await response.json()) as LatestSyncResponse;
        await handleLatest(payload);
        failureCount = 0;
        publishStatus({ state: "healthy", via: "poll" });
      } catch {
        failureCount += 1;
        const retryInMs = Math.min(30_000, 1_000 * 2 ** Math.min(failureCount, 5));
        publishStatus({ state: "degraded", via: "poll", retryInMs });
      }
      if (eventSource?.readyState === EventSource.OPEN) {
        clearPoll();
        return;
      }
      const delay = Math.min(30_000, 2_000 * 2 ** Math.min(failureCount, 4));
      pollTimer = setTimeout(() => void pollOnce(), delay);
    };

    const startSse = () => {
      if (cancelled) return;
      clearPoll();
      publishStatus({ state: "connecting", via: "sse" });
      eventSource = new EventSource("/api/sync/events");

      eventSource.onopen = () => {
        failureCount = 0;
        clearPoll();
        publishStatus({ state: "healthy", via: "sse" });
      };

      eventSource.onmessage = (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(event.data) as LatestSyncResponse;
          void handleLatest(payload);
          failureCount = 0;
          clearPoll();
          publishStatus({ state: "healthy", via: "sse" });
        } catch {
          // Ignore malformed events and keep stream alive.
        }
      };

      eventSource.onerror = () => {
        if (cancelled) return;
        eventSource?.close();
        eventSource = null;
        failureCount += 1;
        const retryInMs = Math.min(30_000, 1_000 * 2 ** Math.min(failureCount, 5));
        publishStatus({ state: "degraded", via: "sse", retryInMs });
        if (!pollTimer) {
          void pollOnce();
        }
        reconnectTimer = setTimeout(startSse, retryInMs);
      };
    };

    startSse();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [queryClient]);

  return null;
}

