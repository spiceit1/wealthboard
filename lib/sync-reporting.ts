type RunReportInput = {
  status: string;
  errorMessage: string | null;
  lastEvent: string | null;
  events?: { message: string }[];
};

// Keep stored failure status for retries; explain confirmed partial writes in the UI.
export function describeSyncRun(run: RunReportInput) {
  const messages = run.events?.map((event) => event.message) ?? [];
  const progress = messages.filter((message) => /^Updated prices for \d+\/\d+ stock symbols and \d+\/\d+ crypto symbols$/.test(message)).at(-1) ?? null;
  const counts = progress?.match(/^Updated prices for (\d+)\/\d+ stock symbols and (\d+)\/\d+ crypto symbols$/);
  const savedPrices = !!counts && Number(counts[1]) + Number(counts[2]) > 0;
  const savedBalances = messages.some((message) => /^Saved .+ balance$/.test(message));
  const partial = run.status === "failed" && (savedPrices || savedBalances);
  return {
    partial,
    label: partial ? "Partially updated" : run.status,
    progress,
    detail: run.errorMessage || run.lastEvent || "—",
  };
}
