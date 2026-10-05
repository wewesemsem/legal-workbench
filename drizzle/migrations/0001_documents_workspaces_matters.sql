CREATE TYPE "public"."workspace_member_role" AS ENUM('OWNER', 'LAWYER', 'CLIENT');--> statement-breakpoint
CREATE TYPE "public"."matter_member_role" AS ENUM('LAWYER', 'CLIENT');--> statement-breakpoint
CREATE TYPE "public"."matter_status" AS ENUM('OPEN', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."document_processing_status" AS ENUM('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_member_role" DEFAULT 'LAWYER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_members" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "matter_member_role" DEFAULT 'LAWYER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matters" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "matter_status" DEFAULT 'OPEN' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"extracted_text" text,
	"layout_data" jsonb,
	"width" integer,
	"height" integer,
	"metadata" jsonb,
	"storage_location" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_location" text NOT NULL,
	"processing_status" "document_processing_status" DEFAULT 'UPLOADED' NOT NULL,
	"processing_error" text,
	"page_count" integer,
	"extracted_text" text,
	"rag_ready_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_members" ADD CONSTRAINT "matter_members_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_members" ADD CONSTRAINT "matter_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_uidx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matter_members_matter_user_uidx" ON "matter_members" USING btree ("matter_id","user_id");--> statement-breakpoint
CREATE INDEX "matter_members_user_idx" ON "matter_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matters_workspace_idx" ON "matters" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "document_audit_document_idx" ON "document_audit_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_audit_actor_idx" ON "document_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "document_pages_document_idx" ON "document_pages" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_pages_document_page_idx" ON "document_pages" USING btree ("document_id","page_number");--> statement-breakpoint
CREATE INDEX "documents_workspace_idx" ON "documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "documents_matter_idx" ON "documents" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("processing_status");