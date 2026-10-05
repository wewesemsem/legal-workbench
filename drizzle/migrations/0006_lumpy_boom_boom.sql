CREATE TYPE "public"."legal_acquisition_method" AS ENUM('OFFICIAL_DOWNLOAD', 'OFFICIAL_API', 'LICENSED_DATASET', 'AUTHORIZED_MANUAL_IMPORT', 'PUBLIC_DOCUMENT', 'FUTURE_CONNECTOR', 'FIXTURE');--> statement-breakpoint
CREATE TYPE "public"."legal_authority_status" AS ENUM('AUTHORITATIVE_SOURCE', 'DERIVED', 'FIXTURE', 'UNVERIFIED');--> statement-breakpoint
ALTER TYPE "public"."legal_source_access_status" ADD VALUE 'REVIEW_REQUIRED';--> statement-breakpoint
ALTER TABLE "legal_documents" ALTER COLUMN "source_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "authority_status" "legal_authority_status" DEFAULT 'UNVERIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "acquisition_method" "legal_acquisition_method" DEFAULT 'AUTHORIZED_MANUAL_IMPORT' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "acquisition_note" text;--> statement-breakpoint
ALTER TABLE "legal_sources" ADD COLUMN "authority_status" "legal_authority_status" DEFAULT 'UNVERIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_sources" ADD COLUMN "acquisition_method" "legal_acquisition_method" DEFAULT 'FUTURE_CONNECTOR' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_sources" ADD COLUMN "approved_for_automated_acquisition" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "legal_documents_authority_idx" ON "legal_documents" USING btree ("authority_status");