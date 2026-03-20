"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/formatters";

type Row = {
  id: string;
  symbol: string;
  assetClass: "cash" | "stock" | "crypto";
  quantity: number;
  lastPrice: number;
  marketValue: number;
  isManual: boolean;
};

type Props = {
  rows: Row[];
};

export function PositionsTable({ rows }: Props) {
  const router = useRouter();
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
    try {
      await fetch("/api/holdings/manual", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: row.symbol,
          assetClass: row.assetClass,
        }),
      });
      router.refresh();
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
    try {
      await fetch("/api/holdings/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: row.symbol,
          assetClass: row.assetClass,
          quantity: nextQty,
        }),
      });
      setEditingId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const renderTable = (title: string, tableRows: Row[]) => (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">Symbol</th>
              <th className="py-2 pr-4">Quantity</th>
              <th className="py-2 pr-4">Price</th>
              <th className="py-2 pr-4">Value</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.id} className="border-b">
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
                <td className="py-2 pr-4">
                  {row.isManual && (row.assetClass === "stock" || row.assetClass === "crypto") ? (
                    <div className="flex gap-2">
                      {editingId === row.id ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveEdit(row)}
                            disabled={busyId === row.id}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
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
                            onClick={() => startEdit(row)}
                            disabled={busyId === row.id}
                            aria-label={`Edit ${row.symbol}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
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
              <tr>
                <td className="py-3 text-muted-foreground" colSpan={6}>
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
