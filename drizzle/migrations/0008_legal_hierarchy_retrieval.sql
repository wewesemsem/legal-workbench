CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "legal_provisions" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "legal_provisions" ADD COLUMN "hierarchy_path" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "hierarchy_path" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "provision_type" "legal_provision_type";--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "provision_number" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "source_text" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "retrieval_text" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "embedding_version" text;--> statement-breakpoint
ALTER TABLE "legal_chunks" ADD COLUMN "search_vector" tsvector;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_provisions_document_hierarchy_uidx" ON "legal_provisions" USING btree ("legal_document_id","hierarchy_path");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_provisions_article_identity_uidx" ON "legal_provisions" USING btree ("legal_document_id","provision_type","provision_number") WHERE "provision_type" = 'ARTICLE' AND "provision_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "legal_provisions_type_number_idx" ON "legal_provisions" USING btree ("legal_document_id","provision_type","provision_number");--> statement-breakpoint
CREATE INDEX "legal_chunks_hierarchy_idx" ON "legal_chunks" USING btree ("hierarchy_path");--> statement-breakpoint
CREATE INDEX "legal_chunks_content_hash_idx" ON "legal_chunks" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "legal_chunks_search_idx" ON "legal_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "legal_chunks_embedding_hnsw_idx" ON "legal_chunks" USING hnsw ("embedding" vector_cosine_ops);