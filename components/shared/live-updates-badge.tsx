"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        status.state === "healthy" &&
          "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        status.state === "connecting" &&
          "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
        status.state === "degraded" &&
          "bg-red-50 text-red-700 ring-1 ring-red-200",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          status.state === "healthy" && "bg-emerald-500",
          status.state === "connecting" && "animate-pulse bg-amber-500",
          status.state === "degraded" && "bg-red-500",
        )}
      />
      {status.state === "healthy" && "Live"}
      {status.state === "connecting" && "Connecting..."}
      {status.state === "degraded" &&
        `Reconnecting${status.retryInMs ? ` in ${formatRetry(status.retryInMs)}` : "..."}`}
    </span>
  );
}
