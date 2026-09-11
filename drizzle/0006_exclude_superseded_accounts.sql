ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "included_in_totals" boolean DEFAULT true NOT NULL;
