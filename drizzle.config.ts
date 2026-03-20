import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const localEnv = config({ path: ".env.local" });
if (localEnv.parsed) {
  Object.assign(process.env, localEnv.parsed);
}
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run Drizzle commands.");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
