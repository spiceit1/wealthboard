/**
 * One-time / occasional maintenance: removes duplicate cash rows and stale Plaid Items
 * left over from relinking before we enforced a single Item per user.
 *
 * Run: npm run db:cleanup-duplicates
 */
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";

const localEnv = config({ path: ".env.local" });
if (localEnv.parsed) {
  Object.assign(process.env, localEnv.parsed);
}
config();

import { db } from "@/db/client";
import { accounts, connections, users } from "@/db/schema";

async function dedupeCashAccountsForUser(userId: string) {
  const rows = await db.query.accounts.findMany({
    where: and(eq(accounts.userId, userId), inArray(accounts.type, ["checking", "savings"])),
  });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.institutionName.trim().toLowerCase()}|${row.name.trim().toLowerCase()}|${row.type}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  let removed = 0;
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => {
      const aTime = a.balanceAsOf?.getTime() ?? 0;
      const bTime = b.balanceAsOf?.getTime() ?? 0;
      return bTime - aTime;
    });
    const [, ...duplicates] = list;
    for (const dup of duplicates) {
      await db.delete(accounts).where(eq(accounts.id, dup.id));
      removed += 1;
    }
  }
  return removed;
}

/** Keep the Plaid connection row most recently touched (last Link); drop older Items. */
async function pruneStalePlaidConnectionsForUser(userId: string) {
  const plaidConns = await db.query.connections.findMany({
    where: and(eq(connections.userId, userId), eq(connections.provider, "plaid")),
    orderBy: (c, { desc: d }) => [d(c.updatedAt)],
  });
  if (plaidConns.length <= 1) return 0;
  let removed = 0;
  for (const stale of plaidConns.slice(1)) {
    await db.delete(accounts).where(eq(accounts.connectionId, stale.id));
    await db.delete(connections).where(eq(connections.id, stale.id));
    removed += 1;
  }
  return removed;
}

async function cleanupUser(userId: string, email: string) {
  const staleConns = await pruneStalePlaidConnectionsForUser(userId);
  const dupes = await dedupeCashAccountsForUser(userId);
  console.log(`User ${email}: removed ${staleConns} stale Plaid connection(s), ${dupes} duplicate cash row(s).`);
}

async function main() {
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  if (!allUsers.length) {
    console.log("No users found.");
    return;
  }
  for (const u of allUsers) {
    await cleanupUser(u.id, u.email);
  }
  console.log("Cleanup finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
