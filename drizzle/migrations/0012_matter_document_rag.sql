ALTER TYPE "public"."agent_run_status" ADD VALUE IF NOT EXISTS 'INCOMPLETE';--> statement-breakpoint
CREATE TABLE "matter_document_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"document_id" text NOT NULL,
	"page_id" text,
	"page_number" integer NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_version" text,
	"search_vector" tsvector,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "matter_document_chunks" ADD CONSTRAINT "matter_document_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_document_chunks" ADD CONSTRAINT "matter_document_chunks_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_document_chunks" ADD CONSTRAINT "matter_document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_document_chunks" ADD CONSTRAINT "matter_document_chunks_page_id_document_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."document_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matter_chunks_workspace_idx" ON "matter_document_chunks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "matter_chunks_matter_idx" ON "matter_document_chunks" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "matter_chunks_document_idx" ON "matter_document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "matter_chunks_matter_document_idx" ON "matter_document_chunks" USING btree ("matter_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matter_chunks_doc_page_chunk_uidx" ON "matter_document_chunks" USING btree ("document_id","page_number","chunk_index");--> statement-breakpoint
CREATE INDEX "matter_chunks_search_vector_idx" ON "matter_document_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "matter_chunks_embedding_hnsw_idx" ON "matter_document_chunks" USING hnsw ("embedding" vector_cosine_ops);
