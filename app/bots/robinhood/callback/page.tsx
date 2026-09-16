"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
export default function RobinhoodCallback() {
  const started = useRef(false);
  const [message, setMessage] = useState("Finishing your secure Robinhood connection…");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code"), state = params.get("state");
    window.history.replaceState(null, "", "/bots/robinhood/callback");
    if (!code || !state || params.has("error")) { setMessage("Authorization was not completed. Return to DCA Bots to try again."); return; }
    void (async () => {
      try {
        const response = await fetch("/api/bots/connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", code, state }) });
        const data = await response.json();
        setMessage(response.ok ? "Robinhood is connected to WealthBoard. Live trading remains off." : data.message ?? "Connection failed. Please try again.");
      } catch { setMessage("Connection could not be confirmed. Return to DCA Bots to check its status."); }
    })();
  }, []);
  return <main className="mx-auto max-w-xl space-y-5 rounded-xl border bg-card p-7"><h1 className="text-2xl font-semibold">Robinhood connection</h1><p role="status">{message}</p><Link className="underline" href="/bots">Return to DCA Bots</Link></main>;
}
