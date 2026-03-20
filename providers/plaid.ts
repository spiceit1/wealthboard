import type { AccountBalance, ProviderResult } from "@/providers/types";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getPlaidClient, getPlaidCountryCodes } from "@/lib/plaid";
import { getPlaidAccessToken } from "@/services/plaidTokens";

export async function fetchPlaidBalances(userId?: string): Promise<ProviderResult<AccountBalance[]>> {
  const resolvedUserId =
    userId ??
    (
      await db.query.users.findFirst({
        where: eq(users.email, "demo@wealthboard.local"),
      })
    )?.id;

  if (!resolvedUserId) {
    throw new Error("No user available for Plaid balance fetch.");
  }

  const accessToken = await getPlaidAccessToken(resolvedUserId);
  if (!accessToken) {
    throw new Error("Plaid access token is missing. Complete Link token exchange first.");
  }

  const plaidClient = getPlaidClient();
  const response = await plaidClient.accountsBalanceGet({
    access_token: accessToken,
  });

  const institutionId = response.data.item.institution_id ?? null;
  let institutionNameFromItem = "Linked bank";
  if (institutionId) {
    try {
      const inst = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: getPlaidCountryCodes(),
      });
      institutionNameFromItem = inst.data.institution.name;
    } catch {
      // Keep generic label if institution lookup fails
    }
  }

  const data: AccountBalance[] = response.data.accounts.map((account) => {
    const subtype = account.subtype ?? "";
    const type: AccountBalance["type"] =
      subtype.includes("checking") || subtype === "checking"
        ? "checking"
        : subtype.includes("savings") || subtype === "savings"
          ? "savings"
          : "brokerage";

    return {
      providerAccountId: account.account_id,
      name: account.name ?? account.official_name ?? "Plaid Account",
      institutionName: institutionNameFromItem,
      type,
      balance: Number(account.balances.current ?? account.balances.available ?? 0),
      currency: "USD",
    };
  });

  return {
    source: "plaid",
    fetchedAt: new Date().toISOString(),
    data,
  };
}
