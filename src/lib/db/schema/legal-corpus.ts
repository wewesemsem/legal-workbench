import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { LEGAL_VECTOR_DIMENSIONS, pgTsvector, pgVector } from "@/lib/db/schema/vector";

/**
 * Public Egyptian legal corpus — NEVER mixed with Matter documents.
 */

export const legalSourceTypeEnum = pgEnum("legal_source_type", [
  "LEGISLATION",
  "JUDICIAL",
  "LEGISLATIVE",
  "OFFICIAL_GAZETTE",
  "OTHER",
]);

export const legalSourceAccessStatusEnum = pgEnum("legal_source_access_status", [
  "PUBLIC",
  "ACCESS_RESTRICTED",
  "AUTHENTICATION_REQUIRED",
  "RATE_LIMITED",
  "NOT_FOUND",
  "ERROR",
  "DEFERRED",
  "UNKNOWN",
  "DISABLED",
  "REVIEW_REQUIRED",
]);

export const legalAuthorityStatusEnum = pgEnum("legal_authority_status", [
  "AUTHORITATIVE_SOURCE",
  "DERIVED",
  "FIXTURE",
  "UNVERIFIED",
]);

export const legalAcquisitionMethodEnum = pgEnum("legal_acquisition_method", [
  "OFFICIAL_DOWNLOAD",
  "OFFICIAL_API",
  "OFFICIAL_PUBLIC_WEB",
  "LICENSED_DATASET",
  "AUTHORIZED_MANUAL_IMPORT",
  "PUBLIC_DOCUMENT",
  "FUTURE_CONNECTOR",
  "FIXTURE",
]);

export const legalDocumentTypeEnum = pgEnum("legal_document_type", [
  "CONSTITUTION",
  "LEGISLATION",
  "REGULATION",
  "JUDGMENT",
  "JUDGMENT_SUMMARY",
  "CONSTITUTIONAL_JUDGMENT",
  "LEGISLATIVE_HISTORY",
  "PARLIAMENTARY_DOCUMENT",
  "OFFICIAL_DECISION",
  "HISTORICAL_LEGAL_MATERIAL",
  "OTHER",
]);

/** Human review gate before production RAG use. */
export const legalReviewStatusEnum = pgEnum("legal_review_status", [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export const legalDocumentStatusEnum = pgEnum("legal_document_status", [
  "UNKNOWN",
  "IN_FORCE",
  "AMENDED",
  "REPEALED",
  "SUPERSEDED",
  "DRAFT",
]);

export const legalIngestionStatusEnum = pgEnum("legal_ingestion_status", [
  "DISCOVERED",
  "FETCHED",
  "PARSED",
  "NORMALIZED",
  "CHUNKED",
  "FAILED",
  "ACCESS_RESTRICTED",
  "SKIPPED",
]);

export const legalTextOriginEnum = pgEnum("legal_text_origin", [
  "SOURCE_TEXT",
  "OCR",
  "SUMMARY",
  "METADATA",
  "DERIVED_TRANSLATION",
  "FIXTURE",
]);

export const legalProvisionTypeEnum = pgEnum("legal_provision_type", [
  "DOCUMENT",
  "BOOK",
  "PART",
  "TITLE",
  "CHAPTER",
  "SECTION",
  "ARTICLE",
  "PARAGRAPH",
  "CLAUSE",
  "OTHER",
]);

export const legalIngestionRunStatusEnum = pgEnum("legal_ingestion_run_status", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "PARTIAL",
]);

export const legalErrorCategoryEnum = pgEnum("legal_error_category", [
  "NETWORK_ERROR",
  "ACCESS_RESTRICTED",
  "PARSE_ERROR",
  "INVALID_CONTENT",
  "OCR_ERROR",
  "DUPLICATE",
  "UNKNOWN",
]);

export const legalSources = pgTable(
  "legal_sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    authority: text("authority").notNull(),
    country: text("country").notNull().default("EG"),
    jurisdiction: text("jurisdiction").notNull().default("Egypt"),
    baseUrl: text("base_url").notNull(),
    sourceType: legalSourceTypeEnum("source_type").notNull(),
    accessStatus: legalSourceAccessStatusEnum("access_status")
      .notNull()
      .default("UNKNOWN"),
    authorityStatus: legalAuthorityStatusEnum("authority_status")
      .notNull()
      .default("UNVERIFIED"),
    acquisitionMethod: legalAcquisitionMethodEnum("acquisition_method")
      .notNull()
      .default("FUTURE_CONNECTOR"),
    /** Reachable ≠ approved for automated acquisition. */
    approvedForAutomatedAcquisition: boolean(
      "approved_for_automated_acquisition",
    )
      .notNull()
      .default(false),
    ingestionEnabled: boolean("ingestion_enabled").notNull().default(true),
    adapterKey: text("adapter_key").notNull(),
    notes: text("notes"),
    lastCheckedAt: timestamp("last_checked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_sources_adapter_key_uidx").on(table.adapterKey),
    index("legal_sources_country_idx").on(table.country),
  ],
);

export const legalIngestionRuns = pgTable(
  "legal_ingestion_runs",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => legalSources.id, { onDelete: "cascade" }),
    status: legalIngestionRunStatusEnum("status").notNull().default("RUNNING"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    discoveredCount: integer("discovered_count").notNull().default(0),
    fetchedCount: integer("fetched_count").notNull().default(0),
    parsedCount: integer("parsed_count").notNull().default(0),
    chunkedCount: integer("chunked_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    restrictedCount: integer("restricted_count").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("legal_ingestion_runs_source_idx").on(table.sourceId)],
);

export const legalDiscoveredDocuments = pgTable(
  "legal_discovered_documents",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => legalSources.id, { onDelete: "cascade" }),
    ingestionRunId: text("ingestion_run_id").references(
      () => legalIngestionRuns.id,
      { onDelete: "set null" },
    ),
    sourceUrl: text("source_url").notNull(),
    title: text("title"),
    documentType: legalDocumentTypeEnum("document_type").notNull(),
    externalId: text("external_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ingestionStatus: legalIngestionStatusEnum("ingestion_status")
      .notNull()
      .default("DISCOVERED"),
    errorCategory: legalErrorCategoryEnum("error_category"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_discovered_source_url_uidx").on(
      table.sourceId,
      table.sourceUrl,
    ),
    index("legal_discovered_external_idx").on(table.sourceId, table.externalId),
  ],
);

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => legalSources.id, { onDelete: "restrict" }),
    country: text("country").notNull().default("EG"),
    jurisdiction: text("jurisdiction").notNull().default("Egypt"),
    language: text("language").notNull().default("ar"),
    documentType: legalDocumentTypeEnum("document_type").notNull(),
    title: text("title").notNull(),
    documentNumber: text("document_number"),
    year: integer("year"),
    issuingAuthority: text("issuing_authority").notNull(),
    publicationDate: text("publication_date"),
    effectiveDate: text("effective_date"),
    expirationDate: text("expiration_date"),
    status: legalDocumentStatusEnum("status").notNull().default("UNKNOWN"),
    /** Nullable for authorized manual imports that retain a provenance note instead. */
    sourceUrl: text("source_url"),
    alternateSourceUrls: jsonb("alternate_source_urls").$type<string[]>(),
    externalId: text("external_id"),
    originalFileLocation: text("original_file_location"),
    checksum: text("checksum").notNull(),
    rawContentHash: text("raw_content_hash").notNull(),
    /** Nature of the stored text (SOURCE_TEXT / OCR / SUMMARY / …). */
    textOrigin: legalTextOriginEnum("text_origin").notNull(),
    authorityStatus: legalAuthorityStatusEnum("authority_status")
      .notNull()
      .default("UNVERIFIED"),
    acquisitionMethod: legalAcquisitionMethodEnum("acquisition_method")
      .notNull()
      .default("AUTHORIZED_MANUAL_IMPORT"),
    acquisitionNote: text("acquisition_note"),
    reviewStatus: legalReviewStatusEnum("review_status")
      .notNull()
      .default("PENDING_REVIEW"),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"),
    ingestionStatus: legalIngestionStatusEnum("ingestion_status")
      .notNull()
      .default("DISCOVERED"),
    previousVersionId: text("previous_version_id"),
    versionNumber: integer("version_number").notNull().default(1),
    normalizedText: text("normalized_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** Explicit isolation marker: always null — corpus is never matter-scoped. */
    matterId: text("matter_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Versioned uniqueness: same external ID/URL may exist across superseding versions.
    uniqueIndex("legal_documents_source_external_version_uidx").on(
      table.sourceId,
      table.externalId,
      table.versionNumber,
    ),
    uniqueIndex("legal_documents_source_url_version_uidx").on(
      table.sourceId,
      table.sourceUrl,
      table.versionNumber,
    ),
    index("legal_documents_checksum_idx").on(table.checksum),
    index("legal_documents_authority_idx").on(table.authorityStatus),
    index("legal_documents_review_idx").on(table.reviewStatus),
    index("legal_documents_number_year_idx").on(
      table.documentNumber,
      table.year,
    ),
    index("legal_documents_title_idx").on(table.title),
  ],
);

export const legalProvisions = pgTable(
  "legal_provisions",
  {
    id: text("id").primaryKey(),
    legalDocumentId: text("legal_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    provisionType: legalProvisionTypeEnum("provision_type").notNull(),
    provisionNumber: text("provision_number"),
    /** Short label. Heading remains the structural heading from the source. */
    title: text("title"),
    heading: text("heading"),
    /** Authoritative source text. Not a translation or summary. */
    text: text("text").notNull(),
    /** Machine path such as constitution.part_1.chapter_2.article_25. */
    hierarchyPath: text("hierarchy_path"),
    sequence: integer("sequence").notNull(),
    pageNumber: integer("page_number"),
    textOrigin: legalTextOriginEnum("text_origin").notNull(),
    language: text("language").notNull().default("ar"),
    sourceUrl: text("source_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("legal_provisions_document_idx").on(table.legalDocumentId),
    index("legal_provisions_parent_idx").on(table.parentId),
    index("legal_provisions_number_idx").on(
      table.legalDocumentId,
      table.provisionNumber,
    ),
    uniqueIndex("legal_provisions_document_hierarchy_uidx").on(
      table.legalDocumentId,
      table.hierarchyPath,
    ),
    index("legal_provisions_type_number_idx").on(
      table.legalDocumentId,
      table.provisionType,
      table.provisionNumber,
    ),
  ],
);

export const legalChunks = pgTable(
  "legal_chunks",
  {
    id: text("id").primaryKey(),
    legalDocumentId: text("legal_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    provisionId: text("provision_id")
      .notNull()
      .references(() => legalProvisions.id, { onDelete: "cascade" }),
    articleNumber: text("article_number"),
    paragraphNumber: text("paragraph_number"),
    provisionType: legalProvisionTypeEnum("provision_type"),
    provisionNumber: text("provision_number"),
    hierarchyPath: text("hierarchy_path"),
    heading: text("heading"),
    /** Authoritative source text. Identical to source_text. */
    text: text("text").notNull(),
    sourceText: text("source_text"),
    /** Contextual text used for embedding and keyword search. Not authoritative. */
    retrievalText: text("retrieval_text"),
    /**
     * Arabic-normalized copy of retrieval text for lexical search only.
     * Never treat this as authoritative legal text.
     */
    normalizedSearchText: text("normalized_search_text"),
    contentHash: text("content_hash"),
    embedding: pgVector("embedding", { dimensions: LEGAL_VECTOR_DIMENSIONS }),
    embeddingModel: text("embedding_model"),
    embeddingVersion: text("embedding_version"),
    searchVector: pgTsvector("search_vector"),
    language: text("language").notNull().default("ar"),
    sourceUrl: text("source_url"),
    pageNumber: integer("page_number"),
    sequence: integer("sequence").notNull(),
    textOrigin: legalTextOriginEnum("text_origin").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("legal_chunks_document_idx").on(table.legalDocumentId),
    index("legal_chunks_provision_idx").on(table.provisionId),
    index("legal_chunks_article_idx").on(
      table.legalDocumentId,
      table.articleNumber,
    ),
    index("legal_chunks_hierarchy_idx").on(table.hierarchyPath),
    index("legal_chunks_content_hash_idx").on(table.contentHash),
  ],
);
