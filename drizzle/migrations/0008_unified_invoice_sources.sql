ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_type_check";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_type_check" CHECK ("invoices"."invoice_type" in ('hourly', 'milestone', 'combined'));
CREATE TABLE "invoice_milestone_links" (
  "id" text PRIMARY KEY NOT NULL,
  "auth_user_id" uuid NOT NULL,
  "invoice_id" text NOT NULL,
  "milestone_id" text NOT NULL,
  "project_id" text NOT NULL,
  "project_name" text,
  "title" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "amount_type" text NOT NULL,
  "amount_value" numeric(12, 2) NOT NULL,
  "completion_mode" text NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX "ux_invoice_milestone_links_invoice_milestone" ON "invoice_milestone_links" USING btree ("invoice_id", "milestone_id");
CREATE UNIQUE INDEX "ux_invoice_milestone_links_active_milestone" ON "invoice_milestone_links" USING btree ("milestone_id") WHERE "invoice_milestone_links"."deleted_at" is null;
CREATE INDEX "idx_invoice_milestone_links_auth_user_id" ON "invoice_milestone_links" USING btree ("auth_user_id");
CREATE INDEX "idx_invoice_milestone_links_invoice_id" ON "invoice_milestone_links" USING btree ("invoice_id");
ALTER TABLE "invoice_milestone_links" ADD CONSTRAINT "fk_invoice_milestone_links_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade;
ALTER TABLE "invoice_milestone_links" ADD CONSTRAINT "fk_invoice_milestone_links_invoice_id_invoices" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade;
ALTER TABLE "invoice_milestone_links" ADD CONSTRAINT "fk_invoice_milestone_links_milestone_id_project_milestones" FOREIGN KEY ("milestone_id") REFERENCES "public"."project_milestones"("id") ON DELETE cascade;
