import { NextResponse } from "next/server";
import { getAuthorizedUserId } from "@/lib/owner-auth";
import { cardError, getCardHistory, getCreditCards } from "@/services/creditCard";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ message: "Sign in required." }, { status: 401, headers });
  try {
    const params = new URL(request.url).searchParams;
    const itemId = params.get("itemId"), accountId = params.get("accountId");
    if (itemId && accountId) return NextResponse.json(await getCardHistory(userId, itemId, accountId), { headers });
    return NextResponse.json(await getCreditCards(userId), { headers });
  } catch (error) { return NextResponse.json({ message: cardError(error) }, { status: 502, headers }); }
}
