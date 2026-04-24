"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  value: string | null | undefined;
  emptyLabel?: string;
};

function toRelativeLabel(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export function RelativeTime({ value, emptyLabel = "-" }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((v) => v + 1);
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  const label = useMemo(() => {
    if (!value) return emptyLabel;
    return toRelativeLabel(value);
  }, [emptyLabel, tick, value]);

  return <>{label}</>;
}

