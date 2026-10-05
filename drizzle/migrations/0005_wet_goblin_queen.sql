CREATE TYPE "public"."legal_document_status" AS ENUM('UNKNOWN', 'IN_FORCE', 'AMENDED', 'REPEALED', 'SUPERSEDED', 'DRAFT');--> statement-breakpoint
CREATE TYPE "public"."legal_document_type" AS ENUM('LEGISLATION', 'REGULATION', 'JUDGMENT', 'JUDGMENT_SUMMARY', 'CONSTITUTIONAL_JUDGMENT', 'LEGISLATIVE_HISTORY', 'PARLIAMENTARY_DOCUMENT', 'OFFICIAL_DECISION', 'HISTORICAL_LEGAL_MATERIAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."legal_error_category" AS ENUM('NETWORK_ERROR', 'ACCESS_RESTRICTED', 'PARSE_ERROR', 'INVALID_CONTENT', 'OCR_ERROR', 'DUPLICATE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."legal_ingestion_run_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."legal_ingestion_status" AS ENUM('DISCOVERED', 'FETCHED', 'PARSED', 'NORMALIZED', 'CHUNKED', 'FAILED', 'ACCESS_RESTRICTED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."legal_provision_type" AS ENUM('DOCUMENT', 'BOOK', 'PART', 'TITLE', 'CHAPTER', 'SECTION', 'ARTICLE', 'PARAGRAPH', 'CLAUSE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."legal_source_access_status" AS ENUM('PUBLIC', 'ACCESS_RESTRICTED', 'UNKNOWN', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."legal_source_type" AS ENUM('LEGISLATION', 'JUDICIAL', 'LEGISLATIVE', 'OFFICIAL_GAZETTE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."legal_text_origin" AS ENUM('SOURCE_TEXT', 'OCR', 'SUMMARY', 'METADATA', 'DERIVED_TRANSLATION', 'FIXTURE');--> statement-breakpoint
CREATE TABLE "legal_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_document_id" text NOT NULL,
	"provision_id" text NOT NULL,
	"article_number" text,
	"paragraph_number" text,
	"heading" text,
	"text" text NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"source_url" text,
	"page_number" integer,
	"sequence" integer NOT NULL,
	"text_origin" "legal_text_origin" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_discovered_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"ingestion_run_id" text,
	"source_url" text NOT NULL,
	"title" text,
	"document_type" "legal_document_type" NOT NULL,
	"external_id" text,
	"metadata" jsonb,
	"ingestion_status" "legal_ingestion_status" DEFAULT 'DISCOVERED' NOT NULL,
	"error_category" "legal_error_category",
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"country" text DEFAULT 'EG' NOT NULL,
	"jurisdiction" text DEFAULT 'Egypt' NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"document_type" "legal_document_type" NOT NULL,
	"title" text NOT NULL,
	"document_number" text,
	"year" integer,
	"issuing_authority" text NOT NULL,
	"publication_date" text,
	"effective_date" text,
	"expiration_date" text,
	"status" "legal_document_status" DEFAULT 'UNKNOWN' NOT NULL,
	"source_url" text NOT NULL,
	"alternate_source_urls" jsonb,
	"external_id" text,
	"original_file_location" text,
	"checksum" text NOT NULL,
	"raw_content_hash" text NOT NULL,
	"text_origin" "legal_text_origin" NOT NULL,
	"ingestion_status" "legal_ingestion_status" DEFAULT 'DISCOVERED' NOT NULL,
	"previous_version_id" text,
	"version_number" integer DEFAULT 1 NOT NULL,
	"normalized_text" text,
	"metadata" jsonb,
	"matter_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_ingestion_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"status" "legal_ingestion_run_status" DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"parsed_count" integer DEFAULT 0 NOT NULL,
	"chunked_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"restricted_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_provisions" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_document_id" text NOT NULL,
	"parent_id" text,
	"provision_type" "legal_provision_type" NOT NULL,
	"provision_number" text,
	"heading" text,
	"text" text NOT NULL,
	"sequence" integer NOT NULL,
	"page_number" integer,
	"text_origin" "legal_text_origin" NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"source_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"authority" text NOT NULL,
	"country" text DEFAULT 'EG' NOT NULL,
	"jurisdiction" text DEFAULT 'Egypt' NOT NULL,
	"base_url" text NOT NULL,
	"source_type" "legal_source_type" NOT NULL,
	"access_status" "legal_source_access_status" DEFAULT 'UNKNOWN' NOT NULL,
	"ingestion_enabled" boolean DEFAULT true NOT NULL,
	"adapter_key" text NOT NULL,
	"notes" text,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD CONSTRAINT "legal_chunks_legal_document_id_legal_documents_id_fk" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD CONSTRAINT "legal_chunks_provision_id_legal_provisions_id_fk" FOREIGN KEY ("provision_id") REFERENCES "public"."legal_provisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_discovered_documents" ADD CONSTRAINT "legal_discovered_documents_source_id_legal_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."legal_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_discovered_documents" ADD CONSTRAINT "legal_discovered_documents_ingestion_run_id_legal_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."legal_ingestion_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_source_id_legal_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."legal_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ingestion_runs" ADD CONSTRAINT "legal_ingestion_runs_source_id_legal_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."legal_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_provisions" ADD CONSTRAINT "legal_provisions_legal_document_id_legal_documents_id_fk" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_chunks_document_idx" ON "legal_chunks" USING btree ("legal_document_id");--> statement-breakpoint
CREATE INDEX "legal_chunks_provision_idx" ON "legal_chunks" USING btree ("provision_id");--> statement-breakpoint
CREATE INDEX "legal_chunks_article_idx" ON "legal_chunks" USING btree ("legal_document_id","article_number");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_discovered_source_url_uidx" ON "legal_discovered_documents" USING btree ("source_id","source_url");--> statement-breakpoint
CREATE INDEX "legal_discovered_external_idx" ON "legal_discovered_documents" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_source_external_version_uidx" ON "legal_documents" USING btree ("source_id","external_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_source_url_version_uidx" ON "legal_documents" USING btree ("source_id","source_url","version_number");--> statement-breakpoint
CREATE INDEX "legal_documents_checksum_idx" ON "legal_documents" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "legal_documents_number_year_idx" ON "legal_documents" USING btree ("document_number","year");--> statement-breakpoint
CREATE INDEX "legal_documents_title_idx" ON "legal_documents" USING btree ("title");--> statement-breakpoint
CREATE INDEX "legal_ingestion_runs_source_idx" ON "legal_ingestion_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "legal_provisions_document_idx" ON "legal_provisions" USING btree ("legal_document_id");--> statement-breakpoint
CREATE INDEX "legal_provisions_parent_idx" ON "legal_provisions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "legal_provisions_number_idx" ON "legal_provisions" USING btree ("legal_document_id","provision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_sources_adapter_key_uidx" ON "legal_sources" USING btree ("adapter_key");--> statement-breakpoint
CREATE INDEX "legal_sources_country_idx" ON "legal_sources" USING btree ("country");