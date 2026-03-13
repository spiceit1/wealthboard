import { NextResponse } from "next/server";
import { z } from "zod";

import { getPlaidClient } from "@/lib/plaid";
import { getDemoUserId } from "@/services/dashboardData";
import { savePlaidAccessToken } from "@/services/plaidTokens";

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  metadata: z
    .object({
      institution: z
        .object({
          institution_id: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await getDemoUserId();
    if (!userId) {
      return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
    }

    const body = exchangeSchema.parse(await request.json());
    const plaid = getPlaidClient();
    const exchange = await plaid.itemPublicTokenExchange({
      public_token: body.publicToken,
    });

    await savePlaidAccessToken({
      userId,
      itemId: exchange.data.item_id,
      accessToken: exchange.data.access_token,
      institutionName: body.metadata?.institution?.name ?? "Plaid Institution",
      institutionId: body.metadata?.institution?.institution_id,
    });

    return NextResponse.json(
      {
        itemId: exchange.data.item_id,
        requestId: exchange.data.request_id,
        status: "connected",
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to exchange Plaid public token.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
