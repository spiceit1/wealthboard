import { NextResponse } from "next/server";
import { z } from "zod";

import { getDemoUserId } from "@/services/dashboardData";
import { upsertManualHolding } from "@/services/manualHoldings";

const upsertSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.number().nonnegative(),
  assetClass: z.enum(["stock", "crypto"]),
  name: z.string().optional(),
});

const removeSchema = z.object({
  symbol: z.string().min(1),
  assetClass: z.enum(["stock", "crypto"]),
});

export async function POST(request: Request) {
  try {
    const userId = await getDemoUserId();
    if (!userId) {
      return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
    }
    const body = upsertSchema.parse(await request.json());
    await upsertManualHolding({
      userId,
      symbol: body.symbol,
      quantity: body.quantity,
      assetClass: body.assetClass,
      name: body.name,
    });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save manual holding." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getDemoUserId();
    if (!userId) {
      return NextResponse.json({ message: "Demo user not found." }, { status: 404 });
    }
    const body = removeSchema.parse(await request.json());
    await upsertManualHolding({
      userId,
      symbol: body.symbol,
      quantity: 0,
      assetClass: body.assetClass,
    });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete manual holding." },
      { status: 400 },
    );
  }
}
