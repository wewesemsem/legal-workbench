import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/auth";
import { conversations } from "@/lib/db/schema/chat";
import { matters } from "@/lib/db/schema/matters";
import { workspaces } from "@/lib/db/schema/workspaces";

export const agentTypeEnum = pgEnum("agent_type", [
  "ORCHESTRATOR",
  "RESEARCH",
  "DOCUMENT",
  "DRAFTING",
  "REVIEW",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "PENDING",
  "PLANNING",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "INCOMPLETE",
]);

export const agentStepStatusEnum = pgEnum("agent_step_status", [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EDITED",
  "CANCELLED",
]);

export const toolRiskLevelEnum = pgEnum("tool_risk_level", [
  "READ",
  "WRITE",
  "EXTERNAL_ACTION",
]);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    initiatedBy: text("initiated_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    agentType: agentTypeEnum("agent_type").notNull(),
    task: text("task").notNull(),
    status: agentRunStatusEnum("status").notNull().default("PENDING"),
    plan: jsonb("plan").$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorSummary: text("error_summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_runs_matter_idx").on(table.matterId),
    index("agent_runs_workspace_idx").on(table.workspaceId),
    index("agent_runs_user_idx").on(table.initiatedBy),
    index("agent_runs_status_idx").on(table.status),
  ],
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: text("id").primaryKey(),
    agentRunId: text("agent_run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    agentType: agentTypeEnum("agent_type").notNull(),
    action: text("action").notNull(),
    tool: text("tool"),
    inputMetadata: jsonb("input_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    outputMetadata: jsonb("output_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: agentStepStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_steps_run_idx").on(table.agentRunId),
    index("agent_steps_run_sequence_idx").on(table.agentRunId, table.sequence),
  ],
);

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    agentRunId: text("agent_run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    riskLevel: toolRiskLevelEnum("risk_level").notNull(),
    description: text("description").notNull(),
    proposedOutput: jsonb("proposed_output")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    editedOutput: jsonb("edited_output").$type<Record<string, unknown>>(),
    status: approvalStatusEnum("status").notNull().default("PENDING"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("approval_requests_run_idx").on(table.agentRunId),
    index("approval_requests_matter_idx").on(table.matterId),
    index("approval_requests_status_idx").on(table.status),
  ],
);

export const agentAuditEvents = pgTable(
  "agent_audit_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    agentRunId: text("agent_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    /** Never store sensitive document/prompt contents. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_audit_matter_idx").on(table.matterId),
    index("agent_audit_run_idx").on(table.agentRunId),
    index("agent_audit_actor_idx").on(table.actorUserId),
  ],
);
