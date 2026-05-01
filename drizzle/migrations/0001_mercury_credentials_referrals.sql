CREATE TABLE "mercury_credentials" (
	"auth_user_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_api_key" text,
	"iv" text,
	"auth_tag" text,
	"key_last_four" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mercury_referrals" (
	"auth_user_id" uuid PRIMARY KEY NOT NULL,
	"referral_url" text DEFAULT 'https://mercury.com/partner/time2pay' NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"first_clicked_at" timestamp with time zone,
	"last_clicked_at" timestamp with time zone,
	"status" text DEFAULT 'clicked' NOT NULL,
	"admin_notes" text,
	"premium_access_granted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "mercury_referrals_status_check" CHECK ("mercury_referrals"."status" in ('clicked', 'pending_review', 'qualified', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX "idx_mercury_credentials_auth_user_id" ON "mercury_credentials" USING btree ("auth_user_id");
--> statement-breakpoint
CREATE INDEX "idx_mercury_referrals_auth_user_id" ON "mercury_referrals" USING btree ("auth_user_id");
--> statement-breakpoint
CREATE INDEX "idx_mercury_referrals_status" ON "mercury_referrals" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_mercury_referrals_premium_access_granted_at" ON "mercury_referrals" USING btree ("premium_access_granted_at");
--> statement-breakpoint
ALTER TABLE "mercury_credentials" ADD CONSTRAINT "fk_mercury_credentials_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mercury_referrals" ADD CONSTRAINT "fk_mercury_referrals_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER set_updated_at_mercury_credentials BEFORE UPDATE ON public.mercury_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_mercury_referrals BEFORE UPDATE ON public.mercury_referrals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
ALTER TABLE public.mercury_credentials ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.mercury_referrals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY mercury_referrals_select_own ON public.mercury_referrals FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
