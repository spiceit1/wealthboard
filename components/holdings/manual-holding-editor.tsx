"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  symbol: string;
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
  const [quantity, setQuantity] = useState("");
  const [assetClass, setAssetClass] = useState<"stock" | "crypto">("stock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to save holding.");
      }
      setSymbol("");
      setQuantity("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save holding.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Manual stock/crypto quantities</p>
      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="rounded-md border px-2 py-1 text-sm"
          placeholder="Symbol (e.g. AAPL)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
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
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Sync updates prices only; your quantities stay manual.
      </p>
    </div>
  );
}
