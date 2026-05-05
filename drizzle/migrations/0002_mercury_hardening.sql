CREATE EXTENSION IF NOT EXISTS supabase_vault;
--> statement-breakpoint
CREATE TABLE "mercury_credential_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"key_last_four" text,
	"success" boolean,
	"error_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mercury_credential_events_action_check" CHECK ("mercury_credential_events"."action" in ('created', 'rotated', 'tested', 'deleted', 'ar_probed'))
);
--> statement-breakpoint
CREATE TABLE "mercury_credential_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"vault_secret_id" uuid,
	"key_last_four" text,
	"retired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_reason" text NOT NULL,
	CONSTRAINT "mercury_credential_history_retired_reason_check" CHECK ("mercury_credential_history"."retired_reason" in ('rotated', 'deleted'))
);
--> statement-breakpoint
ALTER TABLE "mercury_credentials" ADD COLUMN "vault_secret_id" uuid;--> statement-breakpoint
ALTER TABLE "mercury_credentials" ADD COLUMN "ar_access_available" boolean;--> statement-breakpoint
ALTER TABLE "mercury_credentials" ADD COLUMN "ar_access_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mercury_credential_events" ADD CONSTRAINT "fk_mercury_credential_events_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercury_credential_history" ADD CONSTRAINT "fk_mercury_credential_history_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mercury_credential_events_user_occurred_at" ON "mercury_credential_events" USING btree ("auth_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_mercury_credential_history_auth_user_id" ON "mercury_credential_history" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_mercury_credential_history_retired_at" ON "mercury_credential_history" USING btree ("retired_at");
--> statement-breakpoint
ALTER TABLE public.mercury_credential_history ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.mercury_credential_events ENABLE ROW LEVEL SECURITY;