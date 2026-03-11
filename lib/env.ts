import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    MOCK_MODE: z
      .string()
      .default("true")
      .transform((value) => value.toLowerCase() === "true"),
    DATABASE_URL: z.string().optional(),
    APP_URL: z.string().url().default("http://localhost:3000"),
    INTERNAL_SYNC_TOKEN: z.string().min(1).optional(),
  })
  .superRefine(({ MOCK_MODE, DATABASE_URL }, context) => {
    if (!MOCK_MODE && !DATABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required when MOCK_MODE=false.",
        path: ["DATABASE_URL"],
      });
    }
  });

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  MOCK_MODE: process.env.MOCK_MODE,
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: process.env.APP_URL,
  INTERNAL_SYNC_TOKEN: process.env.INTERNAL_SYNC_TOKEN,
});
