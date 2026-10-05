import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { LEGAL_VECTOR_DIMENSIONS } from "@/lib/db/schema/vector";
import type { ResolvedLegalFilters } from "@/modules/legal-retrieval/types";

export type RetrievedChunkRow = {
  chunk_id: string;
  legal_document_id: string;
  provision_id: string;
  source_text: string;
  hierarchy_path: string | null;
  provision_type: string | null;
  provision_number: string | null;
  article_number: string | null;
  heading: string | null;
  language: string;
  source_url: string | null;
  document_title: string;
  document_type: string;
  country: string;
  jurisdiction: string;
  authority_status: string;
  document_number: string | null;
  year: number | null;
  issuing_authority: string;
  score: number | string | null;
};

const CHUNK_COLUMNS = sql`
  c.id as chunk_id,
  c.legal_document_id,
  c.provision_id,
  coalesce(c.source_text, c.text) as source_text,
  c.hierarchy_path,
  coalesce(c.provision_type, p.provision_type) as provision_type,
  coalesce(c.provision_number, p.provision_number) as provision_number,
  c.article_number,
  c.heading,
  c.language,
  coalesce(c.source_url, d.source_url) as source_url,
  d.title as document_title,
  d.document_type,
  d.country,
  d.jurisdiction,
  d.authority_status,
  d.document_number,
  d.year,
  d.issuing_authority
`;

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function filterSql(filters: ResolvedLegalFilters): SQL {
  const parts: SQL[] = [
    sql`d.country = ${filters.country}`,
    sql`d.authority_status = 'AUTHORITATIVE_SOURCE'`,
    sql`d.review_status = 'APPROVED'`,
    sql`d.text_origin not in ('FIXTURE', 'DERIVED_TRANSLATION')`,
    sql`d.matter_id is null`,
    sql`d.status <> 'SUPERSEDED'`,
  ];
  if (filters.jurisdiction) {
    parts.push(sql`d.jurisdiction = ${filters.jurisdiction}`);
  }
  if (filters.language) {
    parts.push(sql`d.language = ${filters.language}`);
  }
  if (filters.documentType) {
    parts.push(sql`d.document_type = ${filters.documentType}::legal_document_type`);
  }
  if (filters.contentType) {
    parts.push(sql`d.text_origin = ${filters.contentType}::legal_text_origin`);
  }
  if (filters.legalDocumentId) {
    parts.push(sql`d.id = ${filters.legalDocumentId}`);
  }
  if (filters.documentNumber) {
    parts.push(sql`d.document_number = ${filters.documentNumber}`);
  }
  if (typeof filters.year === "number") {
    parts.push(sql`d.year = ${filters.year}`);
  }
  return sql.join(parts, sql` and `);
}

export function toVectorLiteral(values: number[]): string {
  if (values.length !== LEGAL_VECTOR_DIMENSIONS) {
    throw new Error(
      `Expected ${LEGAL_VECTOR_DIMENSIONS} embedding dimensions and received ${values.length}`,
    );
  }
  return `[${values
    .map((value) => {
      if (!Number.isFinite(value)) {
        throw new Error("Embedding contains a non-finite value");
      }
      return value.toFixed(8);
    })
    .join(",")}]`;
}

export async function findAuthoritativeInstrument(input: {
  documentNumber: string;
  year: number;
  filters: ResolvedLegalFilters;
}): Promise<boolean> {
  const filters = filterSql({
    ...input.filters,
    documentNumber: input.documentNumber,
    year: input.year,
    documentType: input.filters.documentType,
  });
  const result = await db.execute(sql`
    select d.id
    from legal_documents d
    where ${filters}
      and d.document_type <> 'CONSTITUTION'
    limit 1
  `);
  return rowsOf<{ id: string }>(result).length > 0;
}

export async function keywordSearchChunks(input: {
  tsQuery: string;
  filters: ResolvedLegalFilters;
  limit: number;
}): Promise<RetrievedChunkRow[]> {
  const filters = filterSql(input.filters);
  const result = await db.execute(sql`
    select ${CHUNK_COLUMNS},
      ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', ${input.tsQuery})) as score
    from legal_chunks c
    inner join legal_documents d on d.id = c.legal_document_id
    inner join legal_provisions p on p.id = c.provision_id
    where c.search_vector @@ websearch_to_tsquery('simple', ${input.tsQuery})
      and ${filters}
    order by score desc, c.id asc
    limit ${input.limit}
  `);
  return rowsOf<RetrievedChunkRow>(result);
}

export async function exactArticleChunks(input: {
  articleNumbers: string[];
  filters: ResolvedLegalFilters;
  limit: number;
}): Promise<RetrievedChunkRow[]> {
  if (!input.articleNumbers.length) {
    return [];
  }
  const filters = filterSql(input.filters);
  const provisionMatches = sql.join(
    input.articleNumbers.map((number) => sql`p.provision_number = ${number}`),
    sql` or `,
  );
  const articleMatches = sql.join(
    input.articleNumbers.map((number) => sql`c.article_number = ${number}`),
    sql` or `,
  );
  const result = await db.execute(sql`
    select ${CHUNK_COLUMNS},
      1::float as score
    from legal_chunks c
    inner join legal_documents d on d.id = c.legal_document_id
    inner join legal_provisions p on p.id = c.provision_id
    where (
      (p.provision_type = 'ARTICLE' and (${provisionMatches}))
      or (${articleMatches})
    )
      and ${filters}
    order by c.sequence asc, c.id asc
    limit ${input.limit}
  `);
  return rowsOf<RetrievedChunkRow>(result);
}

export async function vectorSearchChunks(input: {
  vectorLiteral: string;
  filters: ResolvedLegalFilters;
  limit: number;
  minSimilarity: number;
}): Promise<RetrievedChunkRow[]> {
  const filters = filterSql(input.filters);
  const result = await db.execute(sql`
    select ${CHUNK_COLUMNS},
      (1 - (c.embedding <=> ${input.vectorLiteral}::vector)) as score
    from legal_chunks c
    inner join legal_documents d on d.id = c.legal_document_id
    inner join legal_provisions p on p.id = c.provision_id
    where c.embedding is not null
      and (1 - (c.embedding <=> ${input.vectorLiteral}::vector)) >= ${input.minSimilarity}
      and ${filters}
    order by c.embedding <=> ${input.vectorLiteral}::vector asc, c.id asc
    limit ${input.limit}
  `);
  return rowsOf<RetrievedChunkRow>(result);
}

export async function refreshChunkSearchVectors(documentId: string) {
  // Index both original retrieval text and the Arabic-normalized copy so
  // alef/ya/teh-marbuta variants match without rewriting source_text.
  await db.execute(sql`
    update legal_chunks
    set search_vector = to_tsvector(
      'simple',
      coalesce(retrieval_text, '') || ' ' || coalesce(normalized_search_text, '')
    )
    where legal_document_id = ${documentId}
  `);
}
