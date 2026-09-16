CREATE TABLE "robinhood_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tokens_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robinhood_oauth_attempts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"state_hash" text NOT NULL,
	"browser_hash" text NOT NULL,
	"verifier_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "robinhood_connections" ADD CONSTRAINT "robinhood_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robinhood_oauth_attempts" ADD CONSTRAINT "robinhood_oauth_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;