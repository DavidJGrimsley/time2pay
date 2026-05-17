ALTER TABLE "sessions" ADD COLUMN "pr_url" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pr_number" integer;--> statement-breakpoint
CREATE INDEX "idx_sessions_pr_number" ON "sessions" USING btree ("pr_number");