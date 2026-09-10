"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { invalidateByDomains } from "@/lib/query-invalidation";

export function ManualBalanceEditor({ accountId, name, balance }: { accountId: string; name: string; balance: number }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!editing) return <Button size="sm" variant="outline" onClick={() => { setValue(balance.toFixed(2)); setError(""); setEditing(true); }}>Edit balance</Button>;
  return <form className="min-w-56 space-y-2" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/accounts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId, balance: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not save balance.");
      await invalidateByDomains(queryClient, ["accounts", "dashboard", "settings"]);
      setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save balance."); }
    finally { setBusy(false); }
  }}>
    <label className="block text-xs" htmlFor={`balance-${accountId}`}>Balance (USD)</label>
    <input id={`balance-${accountId}`} aria-label={`Balance for ${name}`} className="w-full rounded-md border bg-background px-3 py-2" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} disabled={busy} required />
    <p className="max-w-64 text-xs text-muted-foreground">Updates Wealthboard only. The next successful Plaid sync replaces this manual balance.</p>
    <div className="flex gap-2"><Button size="sm" type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button><Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button></div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </form>;
}
