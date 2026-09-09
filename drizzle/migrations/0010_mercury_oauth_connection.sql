CREATE TABLE "mercury_oauth_attempts" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"flow" text NOT NULL,
	"pkce_verifier_vault_secret_id" uuid,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mercury_oauth_attempts_environment_check" CHECK ("mercury_oauth_attempts"."environment" in ('production', 'sandbox')),
	CONSTRAINT "mercury_oauth_attempts_flow_check" CHECK ("mercury_oauth_attempts"."flow" in ('connect', 'reconnect'))
);
--> statement-breakpoint
CREATE TABLE "mercury_oauth_connections" (
	"auth_user_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"access_token_vault_secret_id" uuid,
	"refresh_token_vault_secret_id" uuid,
	"scopes" text[] NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone,
	"last_refreshed_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"rotation_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "mercury_oauth_connections_pkey" PRIMARY KEY("auth_user_id","environment"),
	CONSTRAINT "mercury_oauth_connections_status_check" CHECK ("mercury_oauth_connections"."status" in ('connected', 'reauthorization_required', 'disconnected')),
	CONSTRAINT "mercury_oauth_connections_environment_check" CHECK ("mercury_oauth_connections"."environment" in ('production', 'sandbox'))
);
--> statement-breakpoint
ALTER TABLE "mercury_credential_events" DROP CONSTRAINT "mercury_credential_events_action_check";--> statement-breakpoint
ALTER TABLE "mercury_oauth_attempts" ADD CONSTRAINT "fk_mercury_oauth_attempts_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercury_oauth_connections" ADD CONSTRAINT "fk_mercury_oauth_connections_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mercury_oauth_attempts_auth_user_id" ON "mercury_oauth_attempts" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_mercury_oauth_attempts_expires_at" ON "mercury_oauth_attempts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_mercury_oauth_connections_auth_user_id" ON "mercury_oauth_connections" USING btree ("auth_user_id");--> statement-breakpoint
ALTER TABLE "mercury_credential_events" ADD CONSTRAINT "mercury_credential_events_action_check" CHECK ("mercury_credential_events"."action" in ('created', 'rotated', 'tested', 'deleted', 'ar_probed', 'oauth_connected', 'oauth_reconnected', 'oauth_refreshed', 'oauth_refresh_failed', 'oauth_disconnected'));
--> statement-breakpoint
CREATE TRIGGER set_updated_at_mercury_oauth_connections BEFORE UPDATE ON public.mercury_oauth_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
ALTER TABLE public.mercury_oauth_connections ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.mercury_oauth_connections FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.mercury_oauth_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.mercury_oauth_attempts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY mercury_oauth_connections_no_direct_access ON public.mercury_oauth_connections
	FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY mercury_oauth_attempts_no_direct_access ON public.mercury_oauth_attempts
	FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
