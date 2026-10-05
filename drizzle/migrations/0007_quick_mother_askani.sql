CREATE TYPE "public"."legal_review_status" AS ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TYPE "public"."legal_acquisition_method" ADD VALUE 'OFFICIAL_PUBLIC_WEB' BEFORE 'LICENSED_DATASET';--> statement-breakpoint
ALTER TYPE "public"."legal_document_type" ADD VALUE 'CONSTITUTION' BEFORE 'LEGISLATION';--> statement-breakpoint
ALTER TYPE "public"."legal_source_access_status" ADD VALUE 'AUTHENTICATION_REQUIRED' BEFORE 'UNKNOWN';--> statement-breakpoint
ALTER TYPE "public"."legal_source_access_status" ADD VALUE 'RATE_LIMITED' BEFORE 'UNKNOWN';--> statement-breakpoint
ALTER TYPE "public"."legal_source_access_status" ADD VALUE 'NOT_FOUND' BEFORE 'UNKNOWN';--> statement-breakpoint
ALTER TYPE "public"."legal_source_access_status" ADD VALUE 'ERROR' BEFORE 'UNKNOWN';--> statement-breakpoint
ALTER TYPE "public"."legal_source_access_status" ADD VALUE 'DEFERRED' BEFORE 'UNKNOWN';--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "review_status" "legal_review_status" DEFAULT 'PENDING_REVIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "review_note" text;--> statement-breakpoint
CREATE INDEX "legal_documents_review_idx" ON "legal_documents" USING btree ("review_status");