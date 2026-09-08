ALTER TABLE "projects" ADD COLUMN "hourly_rate" numeric(12, 2) NOT NULL DEFAULT '0';--> statement-breakpoint
UPDATE "projects"
SET "hourly_rate" = "clients"."hourly_rate"
FROM "clients"
WHERE "projects"."client_id" = "clients"."id"
  AND "projects"."auth_user_id" = "clients"."auth_user_id"
  AND "projects"."pricing_mode" = 'hourly';
