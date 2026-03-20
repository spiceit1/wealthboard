/**
 * Removes specific legacy / incorrect Plaid rows (exact institution + account name).
 * Edit the REMOVALS list if you need different rows.
 *
 * Run: npx tsx db/remove-legacy-accounts.ts
 */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

const localEnv = config({ path: ".env.local" });
if (localEnv.parsed) {
  Object.assign(process.env, localEnv.parsed);
}
config();

import { db } from "@/db/client";
import { accounts } from "@/db/schema";

const REMOVALS: Array<{ institutionName: string; name: string }> = [
  { institutionName: "TD Bank", name: "TD Bank Checking" },
  { institutionName: "BASK Bank", name: "BASK Savings" },
];

async function main() {
  for (const { institutionName, name } of REMOVALS) {
    const deleted = await db
      .delete(accounts)
      .where(and(eq(accounts.institutionName, institutionName), eq(accounts.name, name)))
      .returning({ id: accounts.id });
    console.log(`Removed ${deleted.length} row(s): ${institutionName} / ${name}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
