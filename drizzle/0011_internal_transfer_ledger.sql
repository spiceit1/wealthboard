CREATE TABLE "internal_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_account_id" uuid NOT NULL,
	"destination_account_id" uuid NOT NULL,
	"source_label" text NOT NULL,
	"destination_label" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"transfer_date" date NOT NULL,
	"status" text NOT NULL,
	"destination_balance" numeric(16, 2) NOT NULL,
	"transaction_id" text,
	"evidence" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"intervals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "internal_transfers_user_dedupe" ON "internal_transfers" USING btree ("user_id","dedupe_key");