import { and, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { documents, matterDocumentChunks } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { forbidden } from "@/modules/authorization/errors";
import {
  assertMatterAccess,
  type AuthContext,
} from "@/modules/authorization/permissions";
import { getLegalEmbeddingService } from "@/modules/legal-retrieval/embedding-service";
import { combineHybridScores } from "@/modules/legal-retrieval/hybrid-rank";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";

export type MatterRagHit = {
  chunkId: string;
  documentId: string;
  pageId: string | null;
  pageNumber: number;
  filename: string;
  text: string;
  score: number;
  keywordScore: number;
  vectorScore: number;
};

type ChunkRow = {
  chunk_id: string;
  document_id: string;
  page_id: string | null;
  page_number: number;
  filename: string;
  text: string;
  score: number | string | null;
};

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
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

/**
 * Hybrid Matter document retrieval. Always filters by workspace_id + matter_id.
 */
export async function searchMatterDocumentsHybrid(input: {
  query: string;
  matterId: string;
  workspaceId: string;
  auth: AuthContext;
  limit?: number;
  documentId?: string;
}): Promise<MatterRagHit[]> {
  const access = await assertMatterAccess({
    matterId: input.matterId,
    context: input.auth,
  });
  if (access.workspaceId !== input.workspaceId) {
    throw forbidden("Workspace/matter mismatch for Matter RAG");
  }

  const query = input.query.trim();
  if (!query) return [];

  const env = getEnv();
  const limit = Math.min(Math.max(input.limit ?? env.LEGAL_RETRIEVAL_TOP_K, 1), 30);

  const filters = [
    eq(matterDocumentChunks.workspaceId, input.workspaceId),
    eq(matterDocumentChunks.matterId, input.matterId),
  ];
  if (input.documentId) {
    filters.push(eq(matterDocumentChunks.documentId, input.documentId));
  }

  // Reliable keyword / substring path via query builder.
  const keywordJoined = await db
    .select({
      chunkId: matterDocumentChunks.id,
      documentId: matterDocumentChunks.documentId,
      pageId: matterDocumentChunks.pageId,
      pageNumber: matterDocumentChunks.pageNumber,
      filename: documents.originalFilename,
      text: matterDocumentChunks.text,
    })
    .from(matterDocumentChunks)
    .innerJoin(documents, eq(documents.id, matterDocumentChunks.documentId))
    .where(and(...filters, ilike(matterDocumentChunks.text, `%${query}%`)))
    .limit(limit * 3);

  const keywordRows: ChunkRow[] = keywordJoined.map((row) => ({
    chunk_id: row.chunkId,
    document_id: row.documentId,
    page_id: row.pageId,
    page_number: row.pageNumber,
    filename: row.filename,
    text: row.text,
    score: 1,
  }));

  let vectorRows: ChunkRow[] = [];
  try {
    const embedder = getLegalEmbeddingService();
    const embedded = await embedder.embedTexts([query]);
    const queryVector = embedded.vectors[0];
    if (queryVector?.length) {
      const vectorLiteral = `[${queryVector.join(",")}]`;
      const documentFilter = input.documentId
        ? sql`AND c.document_id = ${input.documentId}`
        : sql``;
      const vectorResult = await db.execute(sql`
        SELECT
          c.id as chunk_id,
          c.document_id,
          c.page_id,
          c.page_number,
          d.original_filename as filename,
          c.text,
          (1 - (c.embedding <=> ${vectorLiteral}::vector)) as score
        FROM matter_document_chunks c
        INNER JOIN documents d ON d.id = c.document_id
        WHERE c.workspace_id = ${input.workspaceId}
          AND c.matter_id = ${input.matterId}
          AND c.embedding IS NOT NULL
          AND (1 - (c.embedding <=> ${vectorLiteral}::vector)) >= ${env.LEGAL_VECTOR_MIN_SIMILARITY}
          ${documentFilter}
        ORDER BY c.embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit * 3}
      `);
      vectorRows = rowsOf<ChunkRow>(vectorResult);
    }
  } catch {
    // Vector path is best-effort; keyword/substring path remains authoritative.
    vectorRows = [];
  }

  if (!keywordRows.length && !vectorRows.length) {
    return [];
  }

  const hybrid = combineHybridScores({
    keyword: keywordRows.map((row) => ({
      id: row.chunk_id,
      score: Number(row.score ?? 0),
    })),
    vector: vectorRows.map((row) => ({
      id: row.chunk_id,
      score: Number(row.score ?? 0),
    })),
    keywordWeight: env.LEGAL_KEYWORD_WEIGHT,
    vectorWeight: env.LEGAL_VECTOR_WEIGHT,
  });

  const byId = new Map<string, ChunkRow>();
  for (const row of [...keywordRows, ...vectorRows]) {
    if (!byId.has(row.chunk_id)) byId.set(row.chunk_id, row);
  }

  return hybrid.slice(0, limit).flatMap((rank) => {
    const row = byId.get(rank.id);
    if (!row) return [];
    return [
      {
        chunkId: row.chunk_id,
        documentId: row.document_id,
        pageId: row.page_id,
        pageNumber: Number(row.page_number),
        filename: row.filename,
        text: row.text,
        score: rank.hybridScore,
        keywordScore: rank.keywordScore,
        vectorScore: rank.vectorScore,
      },
    ];
  });
}

export function matterHitsToEvidence(
  hits: MatterRagHit[],
  matterId: string,
): LegalEvidence[] {
  return hits.map((hit) => ({
    sourceKind: "MATTER_DOCUMENT" as const,
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    provisionId: hit.pageId ?? `${hit.documentId}:p${hit.pageNumber}`,
    title: hit.filename,
    heading: `Page ${hit.pageNumber}`,
    provisionType: "PAGE",
    provisionNumber: String(hit.pageNumber),
    text: hit.text,
    score: hit.score,
    sourceUrl: null,
    authorityStatus: "MATTER_DOCUMENT",
    language: "und",
    hierarchyPath: `matter/${matterId}/document/${hit.documentId}/page/${hit.pageNumber}`,
    documentType: "MATTER_DOCUMENT",
    country: "EG",
    jurisdiction: "Matter",
    issuingAuthority: "Matter Document",
    date: null,
  }));
}
