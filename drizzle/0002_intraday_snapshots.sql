CREATE TABLE "intraday_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cash_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"stocks_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"crypto_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_net_worth" numeric(18, 2) DEFAULT '0' NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
ALTER TABLE "intraday_snapshots" ADD CONSTRAINT "intraday_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intraday_snapshots" ADD CONSTRAINT "intraday_snapshots_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "intraday_snapshots_user_captured_idx" ON "intraday_snapshots" USING btree ("user_id","captured_at");
