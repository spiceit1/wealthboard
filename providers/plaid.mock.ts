import type { AccountBalance, ProviderResult } from "@/providers/types";

/** Mock Plaid returns no cash accounts; use real Plaid Link for checking/savings. */
export async function fetchPlaidBalancesMock(): Promise<ProviderResult<AccountBalance[]>> {
  return {
    source: "plaid",
    fetchedAt: new Date().toISOString(),
    data: [],
  };
}
