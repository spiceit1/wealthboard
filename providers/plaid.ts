import type { AccountBalance, ProviderResult } from "@/providers/types";

export async function fetchPlaidBalances(): Promise<ProviderResult<AccountBalance[]>> {
  throw new Error(
    "Plaid provider is not implemented yet. Use MOCK_MODE=true for local development.",
  );
}
