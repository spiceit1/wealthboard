import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

import { env } from "@/lib/env";

export function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV ?? "sandbox";

  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET are required for Plaid operations.");
  }

  const basePath =
    plaidEnv === "production"
      ? PlaidEnvironments.production
      : plaidEnv === "development"
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox;

  return new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    }),
  );
}

export function getPlaidProducts(): Products[] {
  // Keep products read-only by default.
  return [Products.Auth, Products.Transactions];
}

export function getPlaidCountryCodes(): CountryCode[] {
  return [CountryCode.Us];
}

export function getPlaidClientName() {
  return env.NODE_ENV === "production" ? "WealthBoard" : "WealthBoard (Dev)";
}
