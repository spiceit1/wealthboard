"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTimeEastern, formatUSD } from "@/lib/formatters";
import { invalidateForManualHoldingChange } from "@/lib/query-invalidation";

type Row = {
  id: string;
  symbol: string;
  assetClass: "cash" | "stock" | "crypto";
  quantity: number;
  lastPrice: number;
  marketValue: number;
  updatedAt?: string | null;
  isManual: boolean;
};

type Props = {
  rows: Row[];
};

type HoldingsQueryData = {
  rows: Row[];
};

export function PositionsTable({ rows }: Props) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const stockRows = rows.filter((row) => row.assetClass === "stock");
  const cryptoRows = rows.filter((row) => row.assetClass === "crypto");

  const removeHolding = async (row: Row) => {
    if (!row.isManual || (row.assetClass !== "stock" && row.assetClass !== "crypto")) return;
    setBusyId(row.id);
    setError(null);
    const rollbackRows = (queryClient.getQueryData<HoldingsQueryData>(["holdings-overview"])?.rows ?? []).map(
      (item) => ({ ...item }),
    );
    try {
      queryClient.setQueryData<HoldingsQueryData>(["holdings-overview"], (current) => ({
        rows: (current?.rows ?? []).filter((item) => item.id !== row.id),
      }));
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
      await invalidateForManualHoldingChange(queryClient);
    } catch (error) {
      queryClient.setQueryData<HoldingsQueryData>(["holdings-overview"], { rows: rollbackRows });
      setError(error instanceof Error ? error.message : "Failed to remove holding.");
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (row: Row) => {
    if (!row.isManual || (row.assetClass !== "stock" && row.assetClass !== "crypto")) return;
    setEditingId(row.id);
    setDraftQty(row.assetClass === "crypto" ? row.quantity.toFixed(6) : row.quantity.toFixed(2));
    setError(null);
  };

  const saveEdit = async (row: Row) => {
    if (!row.isManual || (row.assetClass !== "stock" && row.assetClass !== "crypto")) return;
    const nextQty = Number(draftQty);
    if (!Number.isFinite(nextQty) || nextQty < 0) {
      setError("Quantity must be a non-negative number.");
      return;
    }

    setBusyId(row.id);
    setError(null);
    const rollbackRows = (queryClient.getQueryData<HoldingsQueryData>(["holdings-overview"])?.rows ?? []).map(
      (item) => ({ ...item }),
    );
    try {
      queryClient.setQueryData<HoldingsQueryData>(["holdings-overview"], (current) => ({
        rows: (current?.rows ?? []).map((item) =>
          item.id === row.id ? { ...item, quantity: nextQty, marketValue: item.lastPrice * nextQty } : item,
        ),
      }));
      const response = await fetch("/api/holdings/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: row.symbol,
          assetClass: row.assetClass,
          quantity: nextQty,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to save holding.");
      }
      setEditingId(null);
      await invalidateForManualHoldingChange(queryClient);
    } catch (error) {
      queryClient.setQueryData<HoldingsQueryData>(["holdings-overview"], { rows: rollbackRows });
      setError(error instanceof Error ? error.message : "Failed to save holding.");
    } finally {
      setBusyId(null);
    }
  };

  const renderTable = (title: string, tableRows: Row[]) => (
    <div className="space-y-2">
      <h3 className="wb-section-title">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Symbol
              </th>
              <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Quantity
              </th>
              <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Price
              </th>
              <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Value
              </th>
              <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Latest Sync
              </th>
              <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.id} className="wb-table-row">
                <td className="py-2 pr-4">{row.symbol}</td>
                <td className="py-2 pr-4">
                  {editingId === row.id ? (
                    <input
                      className="w-24 rounded-md border px-2 py-1 text-sm"
                      inputMode="decimal"
                      value={draftQty}
                      onChange={(e) => setDraftQty(e.target.value)}
                    />
                  ) : (
                    row.assetClass === "crypto" ? row.quantity.toFixed(6) : row.quantity.toFixed(2)
                  )}
                </td>
                <td className="py-2 pr-4">{formatUSD(row.lastPrice)}</td>
                <td className="py-2 pr-4">{formatUSD(row.marketValue)}</td>
                <td className="py-2 pr-4 text-xs text-muted-foreground">
                  {formatDateTimeEastern(row.updatedAt, "Never")}
                </td>
                <td className="py-2 pr-4">
                  {row.isManual && (row.assetClass === "stock" || row.assetClass === "crypto") ? (
                    <div className="flex gap-2">
                      {editingId === row.id ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="transition-colors"
                            onClick={() => saveEdit(row)}
                            disabled={busyId === row.id}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="transition-colors"
                            onClick={() => {
                              setEditingId(null);
                              setError(null);
                            }}
                            disabled={busyId === row.id}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="transition-colors"
                            onClick={() => startEdit(row)}
                            disabled={busyId === row.id}
                            aria-label={`Edit ${row.symbol}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="transition-colors"
                            onClick={() => removeHolding(row)}
                            disabled={busyId === row.id}
                            aria-label={`Remove ${row.symbol}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
            {!tableRows.length && (
              <tr className="wb-table-row">
                <td className="py-3 text-muted-foreground" colSpan={7}>
                  No {title.toLowerCase()} found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {renderTable("Stocks", stockRows)}
      {renderTable("Crypto", cryptoRows)}
    </div>
  );
}
