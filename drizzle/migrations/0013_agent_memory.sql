CREATE TYPE "public"."memory_type" AS ENUM('WORKING', 'CONVERSATION', 'MATTER', 'USER_PREFERENCE', 'WORKSPACE_PREFERENCE');--> statement-breakpoint
CREATE TYPE "public"."memory_source_type" AS ENUM('USER_PROVIDED', 'LAWYER_CONFIRMED', 'DOCUMENT_DERIVED', 'CONVERSATION_DERIVED', 'AI_DERIVED', 'SYSTEM_DEFINED');--> statement-breakpoint
CREATE TYPE "public"."memory_status" AS ENUM('ACTIVE', 'ARCHIVED', 'DELETED', 'PENDING_CONFIRMATION');--> statement-breakpoint
CREATE TYPE "public"."memory_conflict_status" AS ENUM('PENDING', 'RESOLVED_KEEP_EXISTING', 'RESOLVED_USE_PROPOSED', 'RESOLVED_EDITED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "memories" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text,
	"user_id" text,
	"conversation_id" text,
	"type" "memory_type" NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source_type" "memory_source_type" NOT NULL,
	"source_id" text,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"status" "memory_status" DEFAULT 'ACTIVE' NOT NULL,
	"embedding" vector(1536),
	"search_vector" tsvector,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp,
	"confirmed_at" timestamp,
	"confirmed_by" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "memory_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text,
	"existing_memory_id" text NOT NULL,
	"proposed_key" text NOT NULL,
	"proposed_value" text NOT NULL,
	"proposed_source_type" "memory_source_type" NOT NULL,
	"proposed_source_id" text,
	"status" "memory_conflict_status" DEFAULT 'PENDING' NOT NULL,
	"resolution_note" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_existing_memory_id_memories_id_fk" FOREIGN KEY ("existing_memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_workspace_idx" ON "memories" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "memories_matter_idx" ON "memories" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "memories_user_idx" ON "memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memories_type_idx" ON "memories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "memories_status_idx" ON "memories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "memories_workspace_type_key_idx" ON "memories" USING btree ("workspace_id","type","key");--> statement-breakpoint
CREATE INDEX "memories_search_vector_idx" ON "memories" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "memories_embedding_hnsw_idx" ON "memories" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "memory_conflicts_workspace_idx" ON "memory_conflicts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "memory_conflicts_matter_idx" ON "memory_conflicts" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "memory_conflicts_status_idx" ON "memory_conflicts" USING btree ("status");
