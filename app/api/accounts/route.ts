import { getAuthorizedUserId } from "@/lib/owner-auth";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { manualBalanceSchema } from "@/lib/manual-balance";
import { NextResponse } from "next/server";

import { getAccountsOverview } from "@/services/dashboardData";

export async function GET() {
  const userId = await getAuthorizedUserId();
  if (!userId) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const rows = await getAccountsOverview(userId);
  return NextResponse.json({ rows }, { status: 200 });
}


export async function PATCH(request: Request) {
  // Reject cross-site browser submissions before applying an edit.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const parsed = manualBalanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Enter a valid balance with up to two decimal places." }, { status: 400 });
  try {
    const [saved] = await db.update(accounts).set({
      lastBalance: parsed.data.balance,
      balanceAsOf: new Date(),
      updatedAt: new Date(),
      balanceSource: "manual",
    }).where(and(eq(accounts.userId, userId), eq(accounts.id, parsed.data.accountId), inArray(accounts.type, ["checking", "savings"])))
      .returning({ id: accounts.id });
    if (!saved) return NextResponse.json({ message: "Bank account not found." }, { status: 404 });
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ message: "Could not save the balance. Please try again." }, { status: 500 });
  }
}
