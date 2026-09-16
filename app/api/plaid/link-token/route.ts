import { Products, CreditAccountSubtype } from "plaid";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getPlaidClient, getPlaidClientName, getPlaidCountryCodes, getPlaidProducts } from "@/lib/plaid";
import { getAuthorizedUserId } from "@/lib/owner-auth";
import { getPlaidRedirectUri } from "@/lib/plaid-redirect";
import { getPlaidAccessTokensForUser } from "@/services/plaidTokens";

const requestSchema = z
  .object({
    redirectUri: z.string().url().optional(),
    itemId: z.string().optional(),
    purpose: z.enum(["bank", "investments", "credit"]).default("bank"),
  })
  .optional();

type PlaidApiError = {
  response?: {
    status?: number;
    data?: {
      error_type?: string;
      error_code?: string;
      error_message?: string;
      request_id?: string;
    };
  };
};

export async function POST(request: Request) {
  try {
    const userId = await getAuthorizedUserId();
    if (!userId) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json().catch(() => ({})));
    const plaid = getPlaidClient();
    const linked = payload?.itemId ? (await getPlaidAccessTokensForUser(userId)).find(item => item.itemId === payload.itemId) : null;
    if (payload?.itemId && !linked) return NextResponse.json({ message: "Bank connection not found." }, { status: 404 });

    const createResponse = await plaid.linkTokenCreate({
      client_name: getPlaidClientName(),
      language: "en",
      country_codes: getPlaidCountryCodes(),
      user: { client_user_id: userId },
      ...(linked ? { access_token: linked.accessToken } : { products: payload?.purpose === "credit" ? [Products.Transactions] : payload?.purpose === "investments" ? [Products.Investments] : getPlaidProducts() }),
      ...(!linked && payload?.purpose === "credit" ? { transactions: { days_requested: 365 }, account_filters: { credit: { account_subtypes: [CreditAccountSubtype.CreditCard] } } } : {}),
      redirect_uri: getPlaidRedirectUri(),
    });

    return NextResponse.json(
      {
        linkToken: createResponse.data.link_token,
        expiration: createResponse.data.expiration,
      },
      { status: 200 },
    );
  } catch (error) {
    const plaidError = error as PlaidApiError;
    const status = plaidError.response?.status ?? 500;
    const details = plaidError.response?.data;

    return NextResponse.json(
      {
        message:
          details?.error_message ??
          (error instanceof Error ? error.message : "Failed to create Plaid link token."),
        error: error instanceof Error ? error.message : "Unknown error",
        details: details
          ? {
              type: details.error_type,
              code: details.error_code,
              requestId: details.request_id,
            }
          : undefined,
      },
      { status },
    );
  }
}
