CREATE TYPE "public"."research_source_mode" AS ENUM('CORPUS', 'WEB', 'BOTH');--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"source_mode" "research_source_mode" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "research_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"research_run_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"source_type" text DEFAULT 'WEB' NOT NULL,
	"authority_status" text NOT NULL,
	"source_status" text,
	"domain" text,
	"published_at" text,
	"retrieved_at" timestamp,
	"relevance_score" double precision,
	"excerpt" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_research_run_id_research_runs_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_runs_matter_idx" ON "research_runs" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "research_runs_workspace_idx" ON "research_runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "research_runs_user_idx" ON "research_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "research_sources_run_idx" ON "research_sources" USING btree ("research_run_id");
