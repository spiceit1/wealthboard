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

export function PlaidConnectButton({ disabled = false, itemId }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shouldOpen, setShouldOpen] = useState(false);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | undefined>();
  const [updating, setUpdating] = useState(Boolean(itemId));
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (itemId || !window.location.search.includes("oauth_state_id=")) return;
    const saved = sessionStorage.getItem("wealthboard-plaid-link");
    if (!saved) { setError("Bank authorization expired. Start the connection again."); return; }
    try { const data = JSON.parse(saved); setLinkToken(data.token); setUpdating(data.updating); setReceivedRedirectUri(window.location.href); setShouldOpen(true); }
    catch { setError("Unable to resume bank authorization. Please start again."); }
  }, [itemId]);

  const onSuccess = async (publicToken: string, metadata: unknown) => {
    setLoading(true);
    setError(null);
    try {
      if (updating) {
        await invalidateForPlaidConnectionChange(queryClient);
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
    return itemId ? "Reconnect" : "Connect Plaid";
  }, [loading, itemId]);

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
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        const code = payload?.details?.code ? ` (${payload.details.code})` : "";
        throw new Error((payload?.message ?? "Unable to create Plaid link token.") + code);
      }
      const payload = (await response.json()) as LinkTokenResponse;
      sessionStorage.setItem("wealthboard-plaid-link", JSON.stringify({token:payload.linkToken,updating:Boolean(itemId)}));
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
      <Button size="sm" onClick={beginLinkFlow} disabled={disabled || loading}>
        {buttonLabel}
      </Button>
      {success && <p className="text-xs">Bank authorization saved. Use Dashboard → Sync Now to refresh balances.</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
