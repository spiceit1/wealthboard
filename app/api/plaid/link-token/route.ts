import { NextResponse } from "next/server";
import { z } from "zod";

import { getPlaidClient, getPlaidClientName, getPlaidCountryCodes, getPlaidProducts } from "@/lib/plaid";
import { getDemoUserId } from "@/services/dashboardData";

const requestSchema = z
  .object({
    redirectUri: z.string().url().optional(),
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
    const userId = await getDemoUserId();
    if (!userId) {
      return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
    }

    const payload = requestSchema.parse(await request.json().catch(() => ({})));
    const plaid = getPlaidClient();

    const createResponse = await plaid.linkTokenCreate({
      client_name: getPlaidClientName(),
      language: "en",
      country_codes: getPlaidCountryCodes(),
      user: { client_user_id: userId },
      products: getPlaidProducts(),
      redirect_uri: payload?.redirectUri,
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
