import type { AccountBalance, ProviderResult } from "@/providers/types";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getPlaidClient, getPlaidCountryCodes } from "@/lib/plaid";
import { getPlaidAccessTokensForUser } from "@/services/plaidTokens";

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

  const itemTokens = await getPlaidAccessTokensForUser(resolvedUserId);
  if (!itemTokens.length) {
    throw new Error("Plaid access token is missing. Complete Link token exchange first.");
  }

  const plaidClient = getPlaidClient();
  const data: AccountBalance[] = [];
  const plaidItemIds: string[] = [];

  for (const { accessToken } of itemTokens) {
    const response = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
    });

    const currentItemId = response.data.item.item_id;
    plaidItemIds.push(currentItemId);

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
        // keep generic
      }
    }

    for (const account of response.data.accounts) {
      const subtype = account.subtype ?? "";
      const type: AccountBalance["type"] =
        subtype.includes("checking") || subtype === "checking"
          ? "checking"
          : subtype.includes("savings") || subtype === "savings"
            ? "savings"
            : "brokerage";

      data.push({
        providerAccountId: account.account_id,
        name: account.name ?? account.official_name ?? "Plaid Account",
        institutionName: institutionNameFromItem,
        plaidItemId: currentItemId,
        type,
        balance: Number(account.balances.current ?? account.balances.available ?? 0),
        currency: "USD",
      });
    }
  }

  return {
    source: "plaid",
    fetchedAt: new Date().toISOString(),
    data,
    meta: {
      plaidItemIds,
      plaidItemId: plaidItemIds[0],
    },
  };
}
