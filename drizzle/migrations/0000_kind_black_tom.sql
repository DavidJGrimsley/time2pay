CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"hourly_rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"github_org" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_session_links" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"invoice_id" text NOT NULL,
	"session_id" text NOT NULL,
	"link_mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_session_links_link_mode_check" CHECK ("invoice_session_links"."link_mode" in ('context', 'billed'))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"invoice_type" text DEFAULT 'hourly' NOT NULL,
	"mercury_invoice_id" text,
	"payment_link" text,
	"source_project_id" text,
	"source_project_name" text,
	"source_milestone_id" text,
	"source_milestone_title" text,
	"source_milestone_amount_type" text,
	"source_milestone_amount_value" numeric(12, 2),
	"source_milestone_completion_mode" text,
	"source_milestone_completed_at" timestamp with time zone,
	"source_session_link_mode" text,
	"source_session_hourly_rate" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" in ('draft', 'sent', 'paid', 'overdue')),
	CONSTRAINT "invoices_invoice_type_check" CHECK ("invoices"."invoice_type" in ('hourly', 'milestone')),
	CONSTRAINT "invoices_source_milestone_amount_type_check" CHECK ("invoices"."source_milestone_amount_type" is null or "invoices"."source_milestone_amount_type" in ('percent', 'fixed')),
	CONSTRAINT "invoices_source_milestone_completion_mode_check" CHECK ("invoices"."source_milestone_completion_mode" is null or "invoices"."source_milestone_completion_mode" in ('toggle', 'checklist')),
	CONSTRAINT "invoices_source_session_link_mode_check" CHECK ("invoices"."source_session_link_mode" is null or "invoices"."source_session_link_mode" in ('context', 'billed'))
);
--> statement-breakpoint
CREATE TABLE "milestone_checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"milestone_id" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"amount_type" text NOT NULL,
	"amount_value" numeric(12, 2) NOT NULL,
	"completion_mode" text NOT NULL,
	"due_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "project_milestones_amount_type_check" CHECK ("project_milestones"."amount_type" in ('percent', 'fixed')),
	CONSTRAINT "project_milestones_completion_mode_check" CHECK ("project_milestones"."completion_mode" in ('toggle', 'checklist'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"github_repo" text,
	"pricing_mode" text DEFAULT 'hourly' NOT NULL,
	"total_project_fee" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_pricing_mode_check" CHECK ("projects"."pricing_mode" in ('hourly', 'milestone'))
);
--> statement-breakpoint
CREATE TABLE "session_breaks" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"client" text NOT NULL,
	"client_id" text,
	"project_id" text,
	"task_id" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"duration" integer,
	"notes" text,
	"commit_sha" text,
	"invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"github_branch" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"auth_user_id" uuid PRIMARY KEY NOT NULL,
	"id" text DEFAULT 'me' NOT NULL,
	"company_name" text,
	"logo_url" text,
	"full_name" text,
	"phone" text,
	"email" text,
	"github_pat" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ux_clients_id_auth_user_id" ON "clients" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_invoices_id_auth_user_id" ON "invoices" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_project_milestones_id_auth_user_id" ON "project_milestones" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_projects_id_auth_user_id" ON "projects" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_sessions_id_auth_user_id" ON "sessions" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_tasks_id_auth_user_id" ON "tasks" USING btree ("id","auth_user_id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "fk_clients_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_session_links" ADD CONSTRAINT "fk_invoice_session_links_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_session_links" ADD CONSTRAINT "fk_invoice_session_links_invoice_id_auth_user_id_invoices" FOREIGN KEY ("invoice_id","auth_user_id") REFERENCES "public"."invoices"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_session_links" ADD CONSTRAINT "fk_invoice_session_links_session_id_auth_user_id_sessions" FOREIGN KEY ("session_id","auth_user_id") REFERENCES "public"."sessions"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_client_id_auth_user_id_clients" FOREIGN KEY ("client_id","auth_user_id") REFERENCES "public"."clients"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_source_project_id_auth_user_id_projects" FOREIGN KEY ("source_project_id","auth_user_id") REFERENCES "public"."projects"("id","auth_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_source_milestone_id_auth_user_id_project_milestones" FOREIGN KEY ("source_milestone_id","auth_user_id") REFERENCES "public"."project_milestones"("id","auth_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_checklist_items" ADD CONSTRAINT "fk_milestone_checklist_items_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_checklist_items" ADD CONSTRAINT "fk_milestone_checklist_items_milestone_id_auth_user_id_project_milestones" FOREIGN KEY ("milestone_id","auth_user_id") REFERENCES "public"."project_milestones"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "fk_project_milestones_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "fk_project_milestones_project_id_auth_user_id_projects" FOREIGN KEY ("project_id","auth_user_id") REFERENCES "public"."projects"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "fk_projects_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "fk_projects_client_id_auth_user_id_clients" FOREIGN KEY ("client_id","auth_user_id") REFERENCES "public"."clients"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_breaks" ADD CONSTRAINT "fk_session_breaks_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_breaks" ADD CONSTRAINT "fk_session_breaks_session_id_auth_user_id_sessions" FOREIGN KEY ("session_id","auth_user_id") REFERENCES "public"."sessions"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_client_id_auth_user_id_clients" FOREIGN KEY ("client_id","auth_user_id") REFERENCES "public"."clients"("id","auth_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_project_id_auth_user_id_projects" FOREIGN KEY ("project_id","auth_user_id") REFERENCES "public"."projects"("id","auth_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_task_id_auth_user_id_tasks" FOREIGN KEY ("task_id","auth_user_id") REFERENCES "public"."tasks"("id","auth_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_invoice_id_auth_user_id_invoices" FOREIGN KEY ("invoice_id","auth_user_id") REFERENCES "public"."invoices"("id","auth_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_auth_user_id_user_profiles" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user_profiles"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_project_id_auth_user_id_projects" FOREIGN KEY ("project_id","auth_user_id") REFERENCES "public"."projects"("id","auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_auth_user_id" ON "clients" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_session_links_auth_user_id" ON "invoice_session_links" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_session_links_invoice_id" ON "invoice_session_links" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_session_links_session_id" ON "invoice_session_links" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_invoice_session_links_id_auth_user_id" ON "invoice_session_links" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_invoice_session_links_invoice_session_auth_user" ON "invoice_session_links" USING btree ("invoice_id","session_id","auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_auth_user_id" ON "invoices" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_client_id" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_milestone_checklist_items_auth_user_id" ON "milestone_checklist_items" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_milestone_checklist_items_milestone_id" ON "milestone_checklist_items" USING btree ("milestone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_milestone_checklist_items_id_auth_user_id" ON "milestone_checklist_items" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_project_milestones_auth_user_id" ON "project_milestones" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_project_milestones_project_id" ON "project_milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_milestones_sort_order" ON "project_milestones" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_projects_auth_user_id" ON "projects" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_client_id" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_projects_pricing_mode" ON "projects" USING btree ("pricing_mode");--> statement-breakpoint
CREATE INDEX "idx_session_breaks_auth_user_id" ON "session_breaks" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_session_breaks_session_id" ON "session_breaks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_session_breaks_start_time" ON "session_breaks" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_session_breaks_end_time" ON "session_breaks" USING btree ("end_time");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_session_breaks_id_auth_user_id" ON "session_breaks" USING btree ("id","auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_auth_user_id" ON "sessions" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_start_time" ON "sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_sessions_invoice_id" ON "sessions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_client_id" ON "sessions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_project_id" ON "sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_task_id" ON "sessions" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_sessions_active_per_user" ON "sessions" USING btree ("auth_user_id") WHERE "sessions"."end_time" is null and "sessions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_tasks_auth_user_id" ON "tasks" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_project_id" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_auth_user_id" ON "user_profiles" USING btree ("auth_user_id");
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "fk_user_profiles_auth_user_id_auth_users" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER set_updated_at_user_profiles BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_project_milestones BEFORE UPDATE ON public.project_milestones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_milestone_checklist_items BEFORE UPDATE ON public.milestone_checklist_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_invoices BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_sessions BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_session_breaks BEFORE UPDATE ON public.session_breaks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_invoice_session_links BEFORE UPDATE ON public.invoice_session_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.milestone_checklist_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.session_breaks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.invoice_session_links ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.project_milestones FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.milestone_checklist_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.session_breaks FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.invoice_session_links FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
CREATE POLICY user_profiles_insert_own ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_update_own ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS user_profiles_delete_own ON public.user_profiles;
CREATE POLICY user_profiles_delete_own ON public.user_profiles FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS clients_select_own ON public.clients;
CREATE POLICY clients_select_own ON public.clients FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS clients_insert_own ON public.clients;
CREATE POLICY clients_insert_own ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS clients_update_own ON public.clients;
CREATE POLICY clients_update_own ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS clients_delete_own ON public.clients;
CREATE POLICY clients_delete_own ON public.clients FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS projects_select_own ON public.projects;
CREATE POLICY projects_select_own ON public.projects FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS projects_insert_own ON public.projects;
CREATE POLICY projects_insert_own ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS projects_update_own ON public.projects;
CREATE POLICY projects_update_own ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS projects_delete_own ON public.projects;
CREATE POLICY projects_delete_own ON public.projects FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS tasks_select_own ON public.tasks;
CREATE POLICY tasks_select_own ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS tasks_insert_own ON public.tasks;
CREATE POLICY tasks_insert_own ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS tasks_update_own ON public.tasks;
CREATE POLICY tasks_update_own ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS tasks_delete_own ON public.tasks;
CREATE POLICY tasks_delete_own ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS project_milestones_select_own ON public.project_milestones;
CREATE POLICY project_milestones_select_own ON public.project_milestones FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS project_milestones_insert_own ON public.project_milestones;
CREATE POLICY project_milestones_insert_own ON public.project_milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS project_milestones_update_own ON public.project_milestones;
CREATE POLICY project_milestones_update_own ON public.project_milestones FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS project_milestones_delete_own ON public.project_milestones;
CREATE POLICY project_milestones_delete_own ON public.project_milestones FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS milestone_checklist_items_select_own ON public.milestone_checklist_items;
CREATE POLICY milestone_checklist_items_select_own ON public.milestone_checklist_items FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS milestone_checklist_items_insert_own ON public.milestone_checklist_items;
CREATE POLICY milestone_checklist_items_insert_own ON public.milestone_checklist_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS milestone_checklist_items_update_own ON public.milestone_checklist_items;
CREATE POLICY milestone_checklist_items_update_own ON public.milestone_checklist_items FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS milestone_checklist_items_delete_own ON public.milestone_checklist_items;
CREATE POLICY milestone_checklist_items_delete_own ON public.milestone_checklist_items FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoices_select_own ON public.invoices;
CREATE POLICY invoices_select_own ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoices_insert_own ON public.invoices;
CREATE POLICY invoices_insert_own ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoices_update_own ON public.invoices;
CREATE POLICY invoices_update_own ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoices_delete_own ON public.invoices;
CREATE POLICY invoices_delete_own ON public.invoices FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS sessions_select_own ON public.sessions;
CREATE POLICY sessions_select_own ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS sessions_insert_own ON public.sessions;
CREATE POLICY sessions_insert_own ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS sessions_update_own ON public.sessions;
CREATE POLICY sessions_update_own ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS sessions_delete_own ON public.sessions;
CREATE POLICY sessions_delete_own ON public.sessions FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS session_breaks_select_own ON public.session_breaks;
CREATE POLICY session_breaks_select_own ON public.session_breaks FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS session_breaks_insert_own ON public.session_breaks;
CREATE POLICY session_breaks_insert_own ON public.session_breaks FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS session_breaks_update_own ON public.session_breaks;
CREATE POLICY session_breaks_update_own ON public.session_breaks FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS session_breaks_delete_own ON public.session_breaks;
CREATE POLICY session_breaks_delete_own ON public.session_breaks FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoice_session_links_select_own ON public.invoice_session_links;
CREATE POLICY invoice_session_links_select_own ON public.invoice_session_links FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoice_session_links_insert_own ON public.invoice_session_links;
CREATE POLICY invoice_session_links_insert_own ON public.invoice_session_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoice_session_links_update_own ON public.invoice_session_links;
CREATE POLICY invoice_session_links_update_own ON public.invoice_session_links FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS invoice_session_links_delete_own ON public.invoice_session_links;
CREATE POLICY invoice_session_links_delete_own ON public.invoice_session_links FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
