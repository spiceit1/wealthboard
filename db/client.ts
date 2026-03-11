import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "@/db/schema";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for database access.");
}

const sql = neon(env.DATABASE_URL);

export const db = drizzle({ client: sql, schema });
