import { NextResponse } from "next/server";
import { getAuthorizedUserId } from "@/lib/owner-auth";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  if (!await getAuthorizedUserId()) return json({ message: "Sign in required." }, 401);
  return json({ connected:false, directConnectionAvailable:false, liveTradingEnabled:false });
}
export async function POST() {
  if (!await getAuthorizedUserId()) return json({ message: "Sign in required." }, 401);
  return json({ message: "Robinhood does not support direct WealthBoard authorization. Live trading is unavailable." }, 409);
}
