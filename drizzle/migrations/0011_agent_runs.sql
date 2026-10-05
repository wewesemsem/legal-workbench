CREATE TYPE "public"."agent_type" AS ENUM('ORCHESTRATOR', 'RESEARCH', 'DOCUMENT', 'DRAFTING', 'REVIEW');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('PENDING', 'PLANNING', 'RUNNING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."agent_step_status" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EDITED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."tool_risk_level" AS ENUM('READ', 'WRITE', 'EXTERNAL_ACTION');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"conversation_id" text,
	"initiated_by" text NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"task" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'PENDING' NOT NULL,
	"plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error_summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "agent_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_run_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"action" text NOT NULL,
	"tool" text,
	"input_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "agent_step_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"agent_run_id" text NOT NULL,
	"action" text NOT NULL,
	"risk_level" "tool_risk_level" NOT NULL,
	"description" text NOT NULL,
	"proposed_output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"edited_output" jsonb,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "agent_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"agent_run_id" text,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_initiated_by_user_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_matter_idx" ON "agent_runs" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "agent_runs_workspace_idx" ON "agent_runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_runs_user_idx" ON "agent_runs" USING btree ("initiated_by");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_steps_run_idx" ON "agent_steps" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "agent_steps_run_sequence_idx" ON "agent_steps" USING btree ("agent_run_id","sequence");--> statement-breakpoint
CREATE INDEX "approval_requests_run_idx" ON "approval_requests" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "approval_requests_matter_idx" ON "approval_requests" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_audit_matter_idx" ON "agent_audit_events" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "agent_audit_run_idx" ON "agent_audit_events" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "agent_audit_actor_idx" ON "agent_audit_events" USING btree ("actor_user_id");
