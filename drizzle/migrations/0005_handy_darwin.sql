CREATE TABLE "access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"entitlement_key" text NOT NULL,
	"source" text NOT NULL,
	"grant_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"source_reference_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_grants_source_check" CHECK ("access_grants"."source" in ('stripe_subscription', 'stripe_lifetime', 'apple_subscription', 'apple_lifetime', 'google_subscription', 'google_lifetime', 'mercury_qualified', 'mercury_pending_grace', 'admin')),
	CONSTRAINT "access_grants_grant_type_check" CHECK ("access_grants"."grant_type" in ('subscription', 'lifetime', 'temporary')),
	CONSTRAINT "access_grants_status_check" CHECK ("access_grants"."status" in ('active', 'expired', 'revoked')),
	CONSTRAINT "access_grants_lifetime_expiry_check" CHECK ("access_grants"."grant_type" <> 'lifetime' or "access_grants"."expires_at" is null)
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_provider_check" CHECK ("billing_customers"."provider" in ('stripe', 'apple', 'google', 'revenuecat'))
);
--> statement-breakpoint
CREATE TABLE "billing_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"provider_product_id" text NOT NULL,
	"purchase_type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_purchases_provider_check" CHECK ("billing_purchases"."provider" in ('stripe', 'apple', 'google', 'revenuecat')),
	CONSTRAINT "billing_purchases_type_check" CHECK ("billing_purchases"."purchase_type" in ('lifetime')),
	CONSTRAINT "billing_purchases_status_check" CHECK ("billing_purchases"."status" in ('completed', 'pending', 'refunded', 'disputed'))
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"provider_product_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"grace_expires_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscriptions_provider_check" CHECK ("billing_subscriptions"."provider" in ('stripe', 'apple', 'google', 'revenuecat')),
	CONSTRAINT "billing_subscriptions_plan_check" CHECK ("billing_subscriptions"."plan" in ('monthly', 'annual')),
	CONSTRAINT "billing_subscriptions_status_check" CHECK ("billing_subscriptions"."status" in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'))
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_provider_check" CHECK ("billing_webhook_events"."provider" in ('stripe', 'apple', 'google', 'revenuecat')),
	CONSTRAINT "billing_webhook_events_status_check" CHECK ("billing_webhook_events"."status" in ('received', 'processed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "mercury_referrals" DROP CONSTRAINT "mercury_referrals_status_check";--> statement-breakpoint
ALTER TABLE "mercury_referrals" ALTER COLUMN "status" SET DEFAULT 'not_started';--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "application_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "qualification_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "qualified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "expired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "verification_source" text;--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "external_reference" text;--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "fk_access_grants_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "fk_billing_customers_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_purchases" ADD CONSTRAINT "fk_billing_purchases_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "fk_billing_subscriptions_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_grants_user_entitlement_status" ON "access_grants" USING btree ("auth_user_id","entitlement_key","status");--> statement-breakpoint
CREATE INDEX "idx_access_grants_auth_user_expiry" ON "access_grants" USING btree ("auth_user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_access_grants_user_entitlement_source" ON "access_grants" USING btree ("auth_user_id","entitlement_key","source");--> statement-breakpoint
CREATE INDEX "idx_access_grants_source_reference" ON "access_grants" USING btree ("source","source_reference_id");--> statement-breakpoint
CREATE INDEX "idx_billing_customers_auth_user_id" ON "billing_customers" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_billing_customers_auth_user_provider" ON "billing_customers" USING btree ("auth_user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_billing_customers_provider_customer" ON "billing_customers" USING btree ("provider","provider_customer_id");--> statement-breakpoint
CREATE INDEX "idx_billing_purchases_auth_user_status" ON "billing_purchases" USING btree ("auth_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_billing_purchases_provider_transaction" ON "billing_purchases" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_billing_subscriptions_auth_user_status" ON "billing_subscriptions" USING btree ("auth_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_billing_subscriptions_auth_user_period_end" ON "billing_subscriptions" USING btree ("auth_user_id","current_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_billing_subscriptions_provider_subscription" ON "billing_subscriptions" USING btree ("provider","provider_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_billing_webhook_events_provider_event" ON "billing_webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_billing_webhook_events_status_received" ON "billing_webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "idx_mercury_referrals_qualification_deadline" ON "mercury_referrals" USING btree ("qualification_deadline_at");--> statement-breakpoint
-- `pending_review` historically meant a referral link click, not verified
-- onboarding. Keep it non-entitled while mapping it to the new state model.
UPDATE "mercury_referrals"
SET "status" = CASE
	WHEN "status" = 'pending_review' THEN 'clicked'
	WHEN "status" = 'rejected' THEN 'failed'
	ELSE "status"
END
WHERE "status" IN ('pending_review', 'rejected');--> statement-breakpoint

UPDATE "mercury_referrals"
SET "qualified_at" = COALESCE("qualified_at", "premium_access_granted_at", "updated_at")
WHERE "status" = 'qualified';--> statement-breakpoint

-- Preserve pre-existing manually-qualified users when hosted access
-- enforcement is eventually enabled.
INSERT INTO "access_grants" (
	"auth_user_id",
	"entitlement_key",
	"source",
	"grant_type",
	"status",
	"starts_at",
	"expires_at",
	"metadata"
)
SELECT
	"auth_user_id",
	'hosted_time2pay',
	'mercury_qualified',
	'lifetime',
	'active',
	COALESCE("premium_access_granted_at", "qualified_at", "created_at"),
	NULL,
	jsonb_build_object('migrated_from', 'mercury_referrals')
FROM "mercury_referrals"
WHERE "status" = 'qualified' OR "premium_access_granted_at" IS NOT NULL
ON CONFLICT ("auth_user_id", "entitlement_key", "source") DO NOTHING;--> statement-breakpoint

ALTER TABLE "mercury_referrals" ADD CONSTRAINT "mercury_referrals_status_check" CHECK ("mercury_referrals"."status" in ('not_started', 'clicked', 'application_started', 'pending_qualification', 'qualified', 'failed', 'expired', 'existing_customer'));--> statement-breakpoint

CREATE TRIGGER set_updated_at_billing_customers BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at_billing_subscriptions BEFORE UPDATE ON public.billing_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at_billing_purchases BEFORE UPDATE ON public.billing_purchases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at_billing_webhook_events BEFORE UPDATE ON public.billing_webhook_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_updated_at_access_grants BEFORE UPDATE ON public.access_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.billing_purchases ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.billing_customers FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.billing_subscriptions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.billing_purchases FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.billing_webhook_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.access_grants FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY billing_customers_no_direct_access ON public.billing_customers
	FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY billing_subscriptions_no_direct_access ON public.billing_subscriptions
	FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY billing_purchases_no_direct_access ON public.billing_purchases
	FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY billing_webhook_events_no_direct_access ON public.billing_webhook_events
	FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY access_grants_no_direct_access ON public.access_grants
	FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);