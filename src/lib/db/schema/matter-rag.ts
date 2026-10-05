import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { documentPages, documents } from "@/lib/db/schema/documents";
import { matters } from "@/lib/db/schema/matters";
import {
  LEGAL_VECTOR_DIMENSIONS,
  pgTsvector,
  pgVector,
} from "@/lib/db/schema/vector";
import { workspaces } from "@/lib/db/schema/workspaces";

/**
 * Matter-scoped document chunks for Matter RAG.
 * NEVER mixed with the public legal corpus (`legal_chunks`).
 */
export const matterDocumentChunks = pgTable(
  "matter_document_chunks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageId: text("page_id").references(() => documentPages.id, {
      onDelete: "cascade",
    }),
    pageNumber: integer("page_number").notNull(),
    chunkIndex: integer("chunk_index").notNull().default(0),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: pgVector("embedding", { dimensions: LEGAL_VECTOR_DIMENSIONS }),
    embeddingModel: text("embedding_model"),
    embeddingVersion: text("embedding_version"),
    searchVector: pgTsvector("search_vector"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("matter_chunks_workspace_idx").on(table.workspaceId),
    index("matter_chunks_matter_idx").on(table.matterId),
    index("matter_chunks_document_idx").on(table.documentId),
    index("matter_chunks_matter_document_idx").on(table.matterId, table.documentId),
    uniqueIndex("matter_chunks_doc_page_chunk_uidx").on(
      table.documentId,
      table.pageNumber,
      table.chunkIndex,
    ),
  ],
);
