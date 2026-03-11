import type { AccountBalance, ProviderResult } from "@/providers/types";

export async function fetchPlaidBalancesMock(): Promise<ProviderResult<AccountBalance[]>> {
  return {
    source: "plaid",
    fetchedAt: new Date().toISOString(),
    data: [
      {
        providerAccountId: "td-checking-001",
        name: "TD Bank Checking",
        type: "checking",
        balance: 12845.22,
        currency: "USD",
      },
      {
        providerAccountId: "bask-savings-001",
        name: "BASK Savings",
        type: "savings",
        balance: 30366.78,
        currency: "USD",
      },
    ],
  };
}
