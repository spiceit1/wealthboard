"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

import { Button } from "@/components/ui/button";

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
};

export function PlaidConnectButton({ disabled = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shouldOpen, setShouldOpen] = useState(false);

  const onSuccess = async (publicToken: string, metadata: unknown) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicToken,
          metadata,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Unable to exchange Plaid token.");
      }

      const payload = (await response.json()) as ExchangeResponse;
      if (payload.status === "connected") {
        router.refresh();
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
    onSuccess,
    onExit: () => {
      setShouldOpen(false);
    },
  });

  useEffect(() => {
    if (!shouldOpen || !ready) return;
    open();
  }, [open, ready, shouldOpen]);

  const buttonLabel = useMemo(() => {
    if (loading) return "Connecting...";
    return "Connect Plaid";
  }, [loading]);

  const beginLinkFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Unable to create Plaid link token.");
      }
      const payload = (await response.json()) as LinkTokenResponse;
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
      <Button onClick={beginLinkFlow} disabled={disabled || loading}>
        {buttonLabel}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
