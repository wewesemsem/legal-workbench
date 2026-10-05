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
import { matters } from "@/lib/db/schema/matters";
import { workspaces } from "@/lib/db/schema/workspaces";

/**
 * Customer matter documents — NEVER part of the public legal corpus.
 */
export const documentProcessingStatusEnum = pgEnum(
  "document_processing_status",
  ["UPLOADED", "PROCESSING", "PROCESSED", "FAILED"],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    filename: text("filename").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    storageLocation: text("storage_location").notNull(),
    processingStatus: documentProcessingStatusEnum("processing_status")
      .notNull()
      .default("UPLOADED"),
    processingError: text("processing_error"),
    pageCount: integer("page_count"),
    extractedText: text("extracted_text"),
    /** Opaque structured payload for future Matter RAG (never public corpus). */
    ragReadyMetadata: jsonb("rag_ready_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("documents_workspace_idx").on(table.workspaceId),
    index("documents_matter_idx").on(table.matterId),
    index("documents_status_idx").on(table.processingStatus),
  ],
);

export const documentPages = pgTable(
  "document_pages",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    extractedText: text("extracted_text"),
    layoutData: jsonb("layout_data").$type<Record<string, unknown>>(),
    width: integer("width"),
    height: integer("height"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** Optional original page image storage key (multi-photo uploads). */
    storageLocation: text("storage_location"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("document_pages_document_idx").on(table.documentId),
    index("document_pages_document_page_idx").on(
      table.documentId,
      table.pageNumber,
    ),
  ],
);

export const documentAuditLogs = pgTable(
  "document_audit_logs",
  {
    id: text("id").primaryKey(),
    /** Nullable so delete audits survive after the document row is removed. */
    documentId: text("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("document_audit_document_idx").on(table.documentId),
    index("document_audit_actor_idx").on(table.actorUserId),
  ],
);
