"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  symbol: string;
  name: string;
  assetClass: "cash" | "stock" | "crypto";
  quantity: number;
  isManual: boolean;
};

type Props = {
  rows: Row[];
};

export function ManualHoldingEditor({ rows }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [assetClass, setAssetClass] = useState<"stock" | "crypto">("stock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualRows = rows.filter(
    (row): row is Row & { assetClass: "stock" | "crypto" } =>
      row.isManual && (row.assetClass === "stock" || row.assetClass === "crypto"),
  );

  const addOrUpdate = async () => {
    setBusy(true);
    setError(null);
    try {
      const q = Number(quantity);
      const response = await fetch("/api/holdings/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol,
          quantity: q,
          assetClass,
          name: name || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to save holding.");
      }
      setSymbol("");
      setName("");
      setQuantity("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save holding.");
    } finally {
      setBusy(false);
    }
  };

  const removeHolding = async (row: Row) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/holdings/manual", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: row.symbol,
          assetClass: row.assetClass,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to remove holding.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove holding.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Manual stock/crypto quantities</p>
      <div className="grid gap-2 md:grid-cols-5">
        <input
          className="rounded-md border px-2 py-1 text-sm"
          placeholder="Symbol (e.g. AAPL)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
        <input
          className="rounded-md border px-2 py-1 text-sm"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value as "stock" | "crypto")}
        >
          <option value="stock">Stock</option>
          <option value="crypto">Crypto</option>
        </select>
        <input
          className="rounded-md border px-2 py-1 text-sm"
          placeholder="Quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Button onClick={addOrUpdate} disabled={busy || !symbol || !quantity}>
          Save
        </Button>
      </div>
      {manualRows.length > 0 && (
        <div className="space-y-1">
          {manualRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between text-sm">
              <span>
                {row.symbol} ({row.assetClass}) - qty {row.quantity.toFixed(6)}
              </span>
              <Button variant="outline" size="sm" onClick={() => removeHolding(row)} disabled={busy}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Sync updates prices only; your quantities stay manual.
      </p>
    </div>
  );
}
