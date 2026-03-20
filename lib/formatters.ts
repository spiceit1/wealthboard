/** All user-facing timestamps use Eastern Time (matches Plaid / US banking expectations). */
export const DISPLAY_TIME_ZONE = "America/New_York";

export function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * e.g. `3/20/2026, 8:06:19 PM` in America/New_York (handles DST).
 */
export function formatDateTimeEastern(
  value: Date | string | number | null | undefined,
  emptyLabel = "-",
): string {
  if (value == null) return emptyLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

/** Time-only in Eastern (for compact log lines). */
export function formatTimeEastern(value: Date | string | number | null | undefined, emptyLabel = "-"): string {
  if (value == null) return emptyLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}
