import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, connections, dailySnapshots, holdings, intradaySnapshots, plaidItems, providerTokens, robinhoodConnections, robinhoodOauthAttempts, syncRuns, users } from "@/db/schema";
import { getAuthorizedUserId } from "@/lib/owner-auth";
import { getPlaidClient } from "@/lib/plaid";
import { getPlaidAccessTokensForUser } from "@/services/plaidTokens";
export async function DELETE(request: Request) {
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ message: "Sign in and verify your authenticator first." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== "DELETE MY DATA") return NextResponse.json({ message: "Type DELETE MY DATA to confirm." }, { status: 400 });
  const [locked] = await db.update(users).set({ dataDeletionPending: true }).where(and(eq(users.id,userId),eq(users.dataDeletionPending,false))).returning({id:users.id});
  if (!locked) return NextResponse.json({ message: "Deletion is already in progress." }, { status: 409 });
  try {
    const running = await db.query.syncRuns.findFirst({where:and(eq(syncRuns.userId,userId),inArray(syncRuns.status,["running","pending"]))});
    if (running) return NextResponse.json({message:"Wait for the active sync to finish, then try again."},{status:409});
    const tokens = await getPlaidAccessTokensForUser(userId);
    for (const {accessToken} of tokens) {
      try { await getPlaidClient().itemRemove({access_token:accessToken}); }
      catch (error) {
        const code=(error as {response?:{data?:{error_code?:string}}}).response?.data?.error_code;
        if (code !== "INVALID_ACCESS_TOKEN" && code !== "ITEM_NOT_FOUND") throw error;
      }
    }
    // Child snapshot items and sync events are removed by their cascading foreign keys.
    await db.batch([
      db.delete(robinhoodOauthAttempts).where(eq(robinhoodOauthAttempts.userId,userId)),
      db.delete(robinhoodConnections).where(eq(robinhoodConnections.userId,userId)),
      db.delete(dailySnapshots).where(eq(dailySnapshots.userId,userId)),
      db.delete(intradaySnapshots).where(eq(intradaySnapshots.userId,userId)),
      db.delete(syncRuns).where(eq(syncRuns.userId,userId)),
      db.delete(holdings).where(eq(holdings.userId,userId)),
      db.delete(accounts).where(eq(accounts.userId,userId)),
      db.delete(plaidItems).where(eq(plaidItems.userId,userId)),
      db.delete(providerTokens).where(eq(providerTokens.userId,userId)),
      db.delete(connections).where(eq(connections.userId,userId)),
    ]);
    console.info("WealthBoard financial data deletion completed");
    return NextResponse.json({message:"Plaid disconnected and stored financial records deleted. Your owner sign-in remains available."});
  } catch {
    return NextResponse.json({message:"Deletion could not finish. Some banks may already be disconnected. Retry to complete removal; no success has been reported."},{status:502});
  } finally { await db.update(users).set({dataDeletionPending:false}).where(eq(users.id,userId)); }
}
