"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { invalidateForManualHoldingChange } from "@/lib/query-invalidation";

type HoldingQueryRow = {
  id: string;
  symbol: string;
  name: string;
  assetClass: "cash" | "stock" | "crypto";
  quantity: number;
  lastPrice: number;
  marketValue: number;
  isManual: boolean;
  updatedAt: string | null;
};

type HoldingsQueryData = {
  rows: HoldingQueryRow[];
};

export function ManualHoldingEditor() {
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [assetClass, setAssetClass] = useState<"stock" | "crypto">("stock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addOrUpdate = async () => {
    setBusy(true);
    setError(null);
    let rollbackRows: HoldingQueryRow[] | null = null;
    try {
      const q = Number(quantity);
      const normalizedSymbol = symbol.trim().toUpperCase();
      rollbackRows = (queryClient.getQueryData<HoldingsQueryData>(["holdings-overview"])?.rows ?? []).map(
        (row) => ({ ...row }),
      );
      queryClient.setQueryData<HoldingsQueryData>(["holdings-overview"], (current) => {
        const currentRows = current?.rows ?? [];
        const existing = currentRows.find(
          (row) => row.assetClass === assetClass && row.symbol.toUpperCase() === normalizedSymbol,
        );
        if (existing) {
          return {
            rows: currentRows.map((row) =>
              row.id === existing.id
                ? {
                    ...row,
                    quantity: q,
                    marketValue: row.lastPrice * q,
                    updatedAt: new Date().toISOString(),
                  }
                : row,
            ),
          };
        }
        return {
          rows: [
            ...currentRows,
            {
              id: `optimistic-${assetClass}-${normalizedSymbol}`,
              symbol: normalizedSymbol,
              name: normalizedSymbol,
              assetClass,
              quantity: q,
              lastPrice: 0,
              marketValue: 0,
              isManual: true,
              updatedAt: new Date().toISOString(),
            },
          ],
        };
      });
      const response = await fetch("/api/holdings/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: normalizedSymbol,
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
      await invalidateForManualHoldingChange(queryClient);
    } catch (err) {
      if (rollbackRows) {
        queryClient.setQueryData<HoldingsQueryData>(["holdings-overview"], { rows: rollbackRows });
      }
      setError(err instanceof Error ? err.message : "Failed to save holding.");
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    "rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <p className="wb-section-title">Manual stock/crypto quantities</p>
      <div className="grid gap-2 md:grid-cols-4">
        <input
          className={fieldClass}
          placeholder="Symbol (e.g. AAPL)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
        <select
          className={fieldClass}
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value as "stock" | "crypto")}
        >
          <option value="stock">Stock</option>
          <option value="crypto">Crypto</option>
        </select>
        <input
          className={fieldClass}
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
