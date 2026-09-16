ALTER TABLE "holdings" ADD COLUMN "included_in_totals" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "holdings" ADD COLUMN "plaid_security_id" varchar(191);--> statement-breakpoint
ALTER TABLE "holdings" ADD COLUMN "quantity_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD COLUMN "investments_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD COLUMN "replace_manual_stocks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD COLUMN "holdings_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_plaid_position_uidx" ON "holdings" USING btree ("user_id","account_id","plaid_security_id");