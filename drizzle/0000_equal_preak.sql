CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'brokerage', 'crypto_wallet');--> statement-breakpoint
CREATE TYPE "public"."asset_class" AS ENUM('cash', 'stock', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."event_level" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('plaid', 'snaptrade', 'coingecko');--> statement-breakpoint
CREATE TYPE "public"."snapshot_item_category" AS ENUM('cash_account', 'brokerage_position', 'crypto_holding');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sync_trigger" AS ENUM('manual', 'scheduled', 'system');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid,
	"provider_account_id" varchar(191) NOT NULL,
	"institution_name" varchar(120) NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"last_balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"balance_as_of" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"external_id" varchar(191) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"cash_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"stocks_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"crypto_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_net_worth" numeric(18, 2) DEFAULT '0' NOT NULL,
	"daily_change" numeric(18, 2) DEFAULT '0' NOT NULL,
	"sync_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"symbol" varchar(20) NOT NULL,
	"name" varchar(120) NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"quantity" numeric(22, 8) DEFAULT '0' NOT NULL,
	"last_price" numeric(18, 6) DEFAULT '0' NOT NULL,
	"market_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	"priced_at" timestamp with time zone NOT NULL,
	"source" "provider" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshot_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"category" "snapshot_item_category" NOT NULL,
	"account_id" uuid,
	"holding_id" uuid,
	"label" varchar(120) NOT NULL,
	"symbol" varchar(20),
	"quantity" numeric(22, 8),
	"price" numeric(18, 6),
	"value" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_run_id" uuid NOT NULL,
	"provider" "provider",
	"level" "event_level" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"event_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"trigger" "sync_trigger" DEFAULT 'manual' NOT NULL,
	"is_mock" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_tokens" ADD CONSTRAINT "provider_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_items" ADD CONSTRAINT "snapshot_items_snapshot_id_daily_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."daily_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_items" ADD CONSTRAINT "snapshot_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_items" ADD CONSTRAINT "snapshot_items_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run_events" ADD CONSTRAINT "sync_run_events_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_uidx" ON "accounts" USING btree ("user_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_type_idx" ON "accounts" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_user_provider_external_uidx" ON "connections" USING btree ("user_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "connections_user_provider_idx" ON "connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_snapshots_user_date_uidx" ON "daily_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "daily_snapshots_user_date_idx" ON "daily_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "holdings_user_symbol_idx" ON "holdings" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "prices_symbol_priced_at_uidx" ON "prices" USING btree ("symbol","priced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_tokens_user_provider_uidx" ON "provider_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "snapshot_items_snapshot_category_idx" ON "snapshot_items" USING btree ("snapshot_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_run_events_run_order_uidx" ON "sync_run_events" USING btree ("sync_run_id","event_order");--> statement-breakpoint
CREATE INDEX "sync_runs_user_started_at_idx" ON "sync_runs" USING btree ("user_id","started_at");