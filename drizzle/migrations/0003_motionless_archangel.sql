ALTER TABLE "document_audit_logs" DROP CONSTRAINT "document_audit_logs_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "document_audit_logs" ALTER COLUMN "document_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;