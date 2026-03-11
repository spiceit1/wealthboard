import "dotenv/config";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

async function seed() {
  const seedEmail = "demo@wealthboard.local";
  const existing = await db.query.users.findFirst({
    where: eq(users.email, seedEmail),
  });

  if (!existing) {
    await db.insert(users).values({
      email: seedEmail,
      fullName: "WealthBoard Demo User",
    });
  }

  console.log("Seed complete.");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
