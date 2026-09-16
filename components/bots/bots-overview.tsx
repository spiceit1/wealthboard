"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
export function BotsOverview() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const status = useQuery({ queryKey: ["bot-connection"], queryFn: async () => {
    const r = await fetch("/api/bots/connection", { cache: "no-store" });
    if (!r.ok) throw new Error("Unable to check Robinhood connection.");
    return r.json() as Promise<{ connected: boolean; directConnectionAvailable: boolean }>;
  } });
  async function connect() {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/bots/connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect" }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      window.location.assign(data.url);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Connection unavailable."); setBusy(false); }
  }
  return <section className="space-y-6">
    <div><h1 className="text-2xl font-semibold">DCA Bots</h1><p className="mt-1 text-muted-foreground">Prepare a strategy that buys in stages and sells at your chosen target.</p></div>
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Robinhood connection</h2><span className="rounded bg-muted px-3 py-1 text-sm">Live trading off</span></div>
      <p>{status.isPending ? "Checking connection…" : status.isError ? "Connection status unavailable." : status.data.connected ? "Robinhood authorization saved for WealthBoard." : "Direct website connection is currently unavailable."}</p>
      <p className="text-sm text-muted-foreground">Robinhood rejected the website authorization before returning to WealthBoard. Your assistant connection is separate and remains available. A supported connection to the dedicated Agentic account must be verified before this app can trade.</p>
      <Button onClick={connect} disabled={busy || status.isPending || !status.data?.directConnectionAvailable}>{busy ? "Opening Robinhood…" : status.data?.connected ? "Reconnect Robinhood" : status.data?.directConnectionAvailable ? "Connect Robinhood to WealthBoard" : "Connection awaiting resolution"}</Button>
      {message && <p role="alert">{message}</p>}
    </div>
    <div className="rounded-xl border bg-card p-6 space-y-3"><h2 className="text-lg font-semibold">Your planned setup</h2><dl className="grid gap-3 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">Initial asset</dt><dd>Zcash (ZEC), direct crypto</dd></div><div><dt className="text-sm text-muted-foreground">Funding preference</dt><dd>Your own cash; no borrowing</dd></div><div><dt className="text-sm text-muted-foreground">Strategy status</dt><dd>Not configured</dd></div></dl><p className="text-sm text-muted-foreground">The strategy editor and trading worker are still being built. No automatic orders are enabled. Your account deposit is not a bot allocation.</p></div>
  </section>;
}
