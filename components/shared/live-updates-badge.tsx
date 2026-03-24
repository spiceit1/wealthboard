"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

type LiveStatusDetail = {
  state: "connecting" | "healthy" | "degraded";
  via: "sse" | "poll";
  retryInMs?: number;
};

function formatRetry(ms: number | undefined) {
  if (!ms) return "";
  const sec = Math.max(1, Math.round(ms / 1000));
  return `${sec}s`;
}

export function LiveUpdatesBadge() {
  const [status, setStatus] = useState<LiveStatusDetail>({
    state: "connecting",
    via: "sse",
  });

  useEffect(() => {
    const onStatus = (event: Event) => {
      const custom = event as CustomEvent<LiveStatusDetail>;
      if (custom.detail) {
        setStatus(custom.detail);
      }
    };
    window.addEventListener("wealthboard:live-status", onStatus);
    return () => window.removeEventListener("wealthboard:live-status", onStatus);
  }, []);

  if (status.state === "healthy") {
    return <Badge variant="secondary">Live updates on ({status.via.toUpperCase()})</Badge>;
  }

  if (status.state === "connecting") {
    return <Badge variant="outline">Connecting live updates...</Badge>;
  }

  return (
    <Badge variant="destructive">
      Live updates degraded - retrying in {formatRetry(status.retryInMs)}
    </Badge>
  );
}

