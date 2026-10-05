CREATE TYPE "public"."matter_type" AS ENUM('CRIMINAL', 'CIVIL', 'CORPORATE', 'EMPLOYMENT', 'FAMILY', 'TAX', 'REAL_ESTATE', 'IMMIGRATION', 'OTHER');--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "matter_type" "matter_type" DEFAULT 'OTHER' NOT NULL;