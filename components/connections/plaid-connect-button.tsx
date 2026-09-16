"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

import { Button } from "@/components/ui/button";
import { invalidateForPlaidConnectionChange } from "@/lib/query-invalidation";

type LinkTokenResponse = {
  linkToken: string;
  expiration: string;
};

type ExchangeResponse = {
  status: "connected";
  itemId: string;
};

type Props = {
  disabled?: boolean;
  itemId?: string;
  purpose?: "bank" | "investments";
};

type ApiErrorResponse = {
  message?: string;
  error?: string;
  details?: {
    type?: string;
    code?: string;
    requestId?: string;
  };
};

type PlaidExitError = {
  error_message?: string;
  error_code?: string;
  error_type?: string;
};

export function PlaidConnectButton({ disabled = false, itemId, purpose = "bank" }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shouldOpen, setShouldOpen] = useState(false);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | undefined>();
  const [updating, setUpdating] = useState(Boolean(itemId));
  const [success, setSuccess] = useState(false);
  const [manualChoice, setManualChoice] = useState("");
  const [replaceManualStocks, setReplaceManualStocks] = useState(false);
  useEffect(() => {
    if (itemId || !window.location.search.includes("oauth_state_id=")) return;
    const saved = sessionStorage.getItem("wealthboard-plaid-link");
    if (!saved) { setError("Bank authorization expired. Start the connection again."); return; }
    try { const data = JSON.parse(saved); if ((data.purpose ?? "bank") !== purpose) return; setReplaceManualStocks(Boolean(data.replaceManualStocks)); setLinkToken(data.token); setUpdating(data.updating); setReceivedRedirectUri(window.location.href); setShouldOpen(true); }
    catch { setError("Unable to resume bank authorization. Please start again."); }
  }, [itemId, purpose]);

  const queueInvestmentImport = async () => {
    const response = await fetch("/api/plaid/sync-investments", { method: "POST" });
    if (!response.ok) throw new Error("Connection saved, but the import could not start. Use Sync Investment Holdings below to retry.");
  };

  const onSuccess = async (publicToken: string, metadata: unknown) => {
    setLoading(true);
    setError(null);
    try {
      if (updating) {
        await invalidateForPlaidConnectionChange(queryClient);
        if (purpose === "investments") await queueInvestmentImport();
        setSuccess(true);
        sessionStorage.removeItem("wealthboard-plaid-link");
        return;
      }
      const response = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicToken,
          metadata,
          purpose,
          replaceManualStocks,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        const code = payload?.details?.code ? ` (${payload.details.code})` : "";
        throw new Error((payload?.message ?? "Unable to exchange Plaid token.") + code);
      }

      const payload = (await response.json()) as ExchangeResponse;
      if (payload.status === "connected") {
        await invalidateForPlaidConnectionChange(queryClient);
        if (purpose === "investments") await queueInvestmentImport();
        setSuccess(true);
        sessionStorage.removeItem("wealthboard-plaid-link");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plaid token exchange failed.");
    } finally {
      setLoading(false);
      setShouldOpen(false);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess,
    onExit: (exitError: PlaidExitError | null) => {
      if (exitError) {
        const code = exitError.error_code ? ` (${exitError.error_code})` : "";
        const message = exitError.error_message ?? "Plaid Link closed before completing connection.";
        setError(`${message}${code}`);
      }
      setShouldOpen(false);
    },
  });

  useEffect(() => {
    if (!shouldOpen || !ready) return;
    open();
  }, [open, ready, shouldOpen]);

  const buttonLabel = useMemo(() => {
    if (loading) return "Connecting...";
    return itemId ? "Reconnect" : purpose === "investments" ? "Connect Robinhood / investments" : "Connect another institution with Plaid";
  }, [loading, itemId, purpose]);

  const beginLinkFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUri =
        typeof window !== "undefined" && window.location.origin.startsWith("https://")
          ? `${window.location.origin}/connections`
          : undefined;

      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          redirectUri,
          itemId,
          purpose,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        const code = payload?.details?.code ? ` (${payload.details.code})` : "";
        throw new Error((payload?.message ?? "Unable to create Plaid link token.") + code);
      }
      const payload = (await response.json()) as LinkTokenResponse;
      sessionStorage.setItem("wealthboard-plaid-link", JSON.stringify({token:payload.linkToken,updating:Boolean(itemId),purpose,replaceManualStocks}));
      setLinkToken(payload.linkToken);
      setShouldOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Plaid Link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {purpose === "investments" && !itemId && <label className="block space-y-1 text-xs">
        <span>When the first import succeeds:</span>
        <select aria-label="Manual stock entries after import" className="block w-full rounded-md border bg-background p-2" value={manualChoice} onChange={event => { setManualChoice(event.target.value); setReplaceManualStocks(event.target.value === "replace"); }}>
          <option value="">Choose how to handle your manual stocks</option>
          <option value="replace">Replace all manual stocks with my imported stocks</option>
          <option value="keep">Keep manual stocks — they are held at other brokerages</option>
        </select>
        <span>Crypto stays manual. Replaced stock entries are kept as a backup and excluded from totals.</span>
      </label>}
      <Button size="sm" onClick={beginLinkFlow} disabled={disabled || loading || (purpose === "investments" && !itemId && !manualChoice)}>
        {buttonLabel}
      </Button>
      {success && <p className="text-xs">{purpose === "investments" ? "Investment connection saved. Import started; check Holdings and Sync Logs for progress." : "Bank authorization saved. Use Dashboard → Sync Now to refresh balances."}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
