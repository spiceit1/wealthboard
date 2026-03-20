/**
 * Occasional maintenance:
 * - removes duplicate checking/savings rows (same institution + name + type)
 * - removes duplicate Plaid institution links (same displayName, keep newest link)
 *
 * Run: npm run db:cleanup-duplicates
 *
 * Note: Multiple Plaid Items (e.g. TD + Bask) are supported; this script does not remove connections.
 */
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";

const localEnv = config({ path: ".env.local" });
if (localEnv.parsed) {
  Object.assign(process.env, localEnv.parsed);
}
config();

import { db } from "@/db/client";
import { accounts, connections, plaidItems, users } from "@/db/schema";

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

async function dedupePlaidInstitutionLinksForUser(userId: string) {
  const rows = await db.query.connections.findMany({
    where: and(eq(connections.userId, userId), eq(connections.provider, "plaid")),
  });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.displayName.trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let removed = 0;
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => {
      const aTime = a.updatedAt?.getTime() ?? 0;
      const bTime = b.updatedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
    const [, ...duplicates] = list;
    for (const dup of duplicates) {
      await db.delete(accounts).where(eq(accounts.connectionId, dup.id));
      await db
        .delete(plaidItems)
        .where(and(eq(plaidItems.userId, userId), eq(plaidItems.itemId, dup.externalId)));
      await db.delete(connections).where(eq(connections.id, dup.id));
      removed += 1;
    }
  }
  return removed;
}

async function cleanupUser(userId: string, email: string) {
  const plaid = await dedupePlaidInstitutionLinksForUser(userId);
  const dupes = await dedupeCashAccountsForUser(userId);
  console.log(
    `User ${email}: removed ${plaid} duplicate Plaid link(s), ${dupes} duplicate cash row(s).`,
  );
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
