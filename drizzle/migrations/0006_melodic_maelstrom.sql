CREATE TABLE "user_legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"document_id" text NOT NULL,
	"document_version" text NOT NULL,
	"flow_id" text,
	"flow_version" integer,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_onboarding_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"flow_id" text NOT NULL,
	"flow_version" integer DEFAULT 1 NOT NULL,
	"step_id" text NOT NULL,
	"event_type" text NOT NULL,
	"answer_key" text,
	"answer_value" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "user_onboarding_events_event_type_check" CHECK ("user_onboarding_events"."event_type" in ('step_completed', 'answer_selected', 'legal_accepted', 'flow_completed', 'backfilled'))
);
--> statement-breakpoint
CREATE TABLE "user_onboarding_state" (
	"auth_user_id" uuid PRIMARY KEY NOT NULL,
	"flow_id" text NOT NULL,
	"flow_version" integer DEFAULT 1 NOT NULL,
	"completed_step_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "fk_user_legal_acceptances_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding_events" ADD CONSTRAINT "fk_user_onboarding_events_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding_state" ADD CONSTRAINT "fk_user_onboarding_state_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_legal_acceptances_user_document" ON "user_legal_acceptances" USING btree ("auth_user_id","document_id");--> statement-breakpoint
CREATE INDEX "idx_user_legal_acceptances_accepted_at" ON "user_legal_acceptances" USING btree ("accepted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_user_legal_acceptances_user_document_version" ON "user_legal_acceptances" USING btree ("auth_user_id","document_id","document_version");--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_events_user_occurred_at" ON "user_onboarding_events" USING btree ("auth_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_events_user_step" ON "user_onboarding_events" USING btree ("auth_user_id","step_id");--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_state_flow" ON "user_onboarding_state" USING btree ("flow_id","flow_version");--> statement-breakpoint
CREATE INDEX "idx_user_onboarding_state_completed_at" ON "user_onboarding_state" USING btree ("completed_at");--> statement-breakpoint

-- Existing hosted users have already seen the app. Seed onboarding state so
-- they skip intro/features but still accept the current legal documents once.
INSERT INTO "user_onboarding_state" (
	"auth_user_id",
	"flow_id",
	"flow_version",
	"completed_step_ids",
	"completed_at",
	"metadata"
)
SELECT
	"auth_user_id",
	'time2pay-onboarding',
	1,
	'["welcome", "features", "auth"]'::jsonb,
	NULL,
	jsonb_build_object('backfilled', true, 'reason', 'existing_user')
FROM "user_profiles"
ON CONFLICT ("auth_user_id") DO NOTHING;--> statement-breakpoint

INSERT INTO "user_onboarding_events" (
	"auth_user_id",
	"flow_id",
	"flow_version",
	"step_id",
	"event_type",
	"metadata"
)
SELECT
	"auth_user_id",
	'time2pay-onboarding',
	1,
	'auth',
	'backfilled',
	jsonb_build_object('reason', 'existing_user')
FROM "user_profiles";--> statement-breakpoint

CREATE TRIGGER set_updated_at_user_onboarding_state BEFORE UPDATE ON public.user_onboarding_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

ALTER TABLE public.user_onboarding_state ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_onboarding_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_onboarding_state FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_onboarding_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_legal_acceptances FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY user_onboarding_state_select_own ON public.user_onboarding_state
	FOR SELECT TO authenticated USING ((select auth.uid()) = auth_user_id);--> statement-breakpoint
CREATE POLICY user_onboarding_state_insert_own ON public.user_onboarding_state
	FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = auth_user_id);--> statement-breakpoint
CREATE POLICY user_onboarding_state_update_own ON public.user_onboarding_state
	FOR UPDATE TO authenticated USING ((select auth.uid()) = auth_user_id) WITH CHECK ((select auth.uid()) = auth_user_id);--> statement-breakpoint

CREATE POLICY user_onboarding_events_select_own ON public.user_onboarding_events
	FOR SELECT TO authenticated USING ((select auth.uid()) = auth_user_id);--> statement-breakpoint
CREATE POLICY user_onboarding_events_insert_own ON public.user_onboarding_events
	FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = auth_user_id);--> statement-breakpoint

CREATE POLICY user_legal_acceptances_select_own ON public.user_legal_acceptances
	FOR SELECT TO authenticated USING ((select auth.uid()) = auth_user_id);--> statement-breakpoint
CREATE POLICY user_legal_acceptances_insert_own ON public.user_legal_acceptances
	FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = auth_user_id);
