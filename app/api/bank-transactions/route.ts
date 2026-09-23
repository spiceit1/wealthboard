import { NextResponse } from "next/server";
import { getAuthorizedUserId } from "@/lib/owner-auth";
import { bankTransactionError, getBankTransactionHistory, getBankTransactionAccounts } from "@/services/bankTransactions";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ message: "Sign in required." }, { status: 401, headers });
  try {
    const params = new URL(request.url).searchParams;
    const itemId = params.get("itemId"), accountId = params.get("accountId");
    if (Boolean(itemId) !== Boolean(accountId)) return NextResponse.json({ message: "Select a bank account." }, { status: 400, headers });
    if (itemId && accountId) return NextResponse.json(await getBankTransactionHistory(userId, itemId, accountId), { headers });
    return NextResponse.json(await getBankTransactionAccounts(userId), { headers });
  } catch (error) { return NextResponse.json({ message: bankTransactionError(error) }, { status: 502, headers }); }
}
