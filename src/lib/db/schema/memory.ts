import {
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/auth";
import { conversations } from "@/lib/db/schema/chat";
import { matters } from "@/lib/db/schema/matters";
import {
  LEGAL_VECTOR_DIMENSIONS,
  pgTsvector,
  pgVector,
} from "@/lib/db/schema/vector";
import { workspaces } from "@/lib/db/schema/workspaces";

/**
 * Controlled agent memory — contextual only, NEVER legal authority.
 * Completely separate from legal_chunks and matter_document_chunks.
 */
export const memoryTypeEnum = pgEnum("memory_type", [
  "WORKING",
  "CONVERSATION",
  "MATTER",
  "USER_PREFERENCE",
  "WORKSPACE_PREFERENCE",
]);

export const memorySourceTypeEnum = pgEnum("memory_source_type", [
  "USER_PROVIDED",
  "LAWYER_CONFIRMED",
  "DOCUMENT_DERIVED",
  "CONVERSATION_DERIVED",
  "AI_DERIVED",
  "SYSTEM_DEFINED",
]);

export const memoryStatusEnum = pgEnum("memory_status", [
  "ACTIVE",
  "ARCHIVED",
  "DELETED",
  "PENDING_CONFIRMATION",
]);

export const memoryConflictStatusEnum = pgEnum("memory_conflict_status", [
  "PENDING",
  "RESOLVED_KEEP_EXISTING",
  "RESOLVED_USE_PROPOSED",
  "RESOLVED_EDITED",
  "CANCELLED",
]);

export const memories = pgTable(
  "memories",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id").references(() => matters.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    type: memoryTypeEnum("type").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    sourceType: memorySourceTypeEnum("source_type").notNull(),
    sourceId: text("source_id"),
    confidence: doublePrecision("confidence").notNull().default(1),
    status: memoryStatusEnum("status").notNull().default("ACTIVE"),
    embedding: pgVector("embedding", { dimensions: LEGAL_VECTOR_DIMENSIONS }),
    searchVector: pgTsvector("search_vector"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp("expires_at"),
    confirmedAt: timestamp("confirmed_at"),
    confirmedBy: text("confirmed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("memories_workspace_idx").on(table.workspaceId),
    index("memories_matter_idx").on(table.matterId),
    index("memories_user_idx").on(table.userId),
    index("memories_type_idx").on(table.type),
    index("memories_status_idx").on(table.status),
    index("memories_workspace_type_key_idx").on(
      table.workspaceId,
      table.type,
      table.key,
    ),
  ],
);

export const memoryConflicts = pgTable(
  "memory_conflicts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id").references(() => matters.id, {
      onDelete: "cascade",
    }),
    existingMemoryId: text("existing_memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    proposedKey: text("proposed_key").notNull(),
    proposedValue: text("proposed_value").notNull(),
    proposedSourceType: memorySourceTypeEnum("proposed_source_type").notNull(),
    proposedSourceId: text("proposed_source_id"),
    status: memoryConflictStatusEnum("status").notNull().default("PENDING"),
    resolutionNote: text("resolution_note"),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("memory_conflicts_workspace_idx").on(table.workspaceId),
    index("memory_conflicts_matter_idx").on(table.matterId),
    index("memory_conflicts_status_idx").on(table.status),
  ],
);
