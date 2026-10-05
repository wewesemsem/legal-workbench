import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { legalChunks, legalProvisions } from "@/lib/db/schema";
import { sha256Hex } from "@/modules/legal-corpus/checksum";
import { chunkProvisions } from "@/modules/legal-corpus/chunk";
import { assignHierarchyPaths } from "@/modules/legal-corpus/hierarchy";
import type { ParsedLegalDocument } from "@/modules/legal-corpus/types";
import { buildNormalizedSearchText } from "@/modules/legal-retrieval/arabic-normalize";
import { getLegalEmbeddingConfig, getLegalRetrievalConfig } from "@/modules/legal-retrieval/config";
import { canReuseEmbedding } from "@/modules/legal-retrieval/hybrid-rank";
import { refreshChunkSearchVectors } from "@/modules/legal-retrieval/repository";
import { buildRetrievalText } from "@/modules/legal-retrieval/retrieval-text";

export async function persistProvisionsAndChunks(input: {
  documentId: string;
  sourceUrl: string | null;
  parsed: ParsedLegalDocument;
}) {
  const config = getLegalRetrievalConfig();
  const embedding = getLegalEmbeddingConfig();
  const nodes = assignHierarchyPaths(input.parsed.documentType, input.parsed.provisions);
  const drafts = chunkProvisions(input.parsed.provisions, {
    documentType: input.parsed.documentType,
    maxArticleChars: config.chunkMaxChars,
  });

  const previous = await db
    .select({
      hierarchyPath: legalChunks.hierarchyPath,
      contentHash: legalChunks.contentHash,
      embedding: legalChunks.embedding,
      embeddingModel: legalChunks.embeddingModel,
      embeddingVersion: legalChunks.embeddingVersion,
    })
    .from(legalChunks)
    .where(eq(legalChunks.legalDocumentId, input.documentId));
  const previousByPath = new Map(
    previous
      .filter((row) => row.hierarchyPath)
      .map((row) => [row.hierarchyPath as string, row]),
  );

  await db.delete(legalChunks).where(eq(legalChunks.legalDocumentId, input.documentId));
  await db.delete(legalProvisions).where(eq(legalProvisions.legalDocumentId, input.documentId));

  const provisionIdByPath = new Map<string, string>();
  for (const node of nodes) {
    const provisionId = crypto.randomUUID();
    provisionIdByPath.set(node.hierarchyPath, provisionId);
    const parentId = node.parentHierarchyPath
      ? (provisionIdByPath.get(node.parentHierarchyPath) ?? null)
      : null;
    await db.insert(legalProvisions).values({
      id: provisionId,
      legalDocumentId: input.documentId,
      parentId,
      provisionType: node.provision.provisionType,
      provisionNumber: node.provision.provisionNumber ?? null,
      title: node.provision.heading ?? null,
      heading: node.provision.heading ?? null,
      text: node.provision.text,
      hierarchyPath: node.hierarchyPath,
      sequence: node.provision.sequence,
      pageNumber: node.provision.pageNumber ?? null,
      textOrigin: node.provision.textOrigin,
      language: input.parsed.language,
      sourceUrl: input.sourceUrl,
      metadata: node.provision.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  for (const draft of drafts) {
    const provisionId = provisionIdByPath.get(draft.hierarchyPath);
    if (!provisionId) {
      continue;
    }
    const retrievalText = buildRetrievalText({
      documentTitle: input.parsed.title,
      documentType: input.parsed.documentType,
      ancestors: draft.ancestors,
      provisionType: draft.provisionType,
      provisionNumber: draft.provisionNumber,
      heading: draft.heading,
      sourceText: draft.sourceText,
    });
    const contentHash = sha256Hex(retrievalText);
    const normalizedSearchText = buildNormalizedSearchText(retrievalText);
    const saved = previousByPath.get(draft.hierarchyPath);
    const reuse = canReuseEmbedding({
      previousHash: saved?.contentHash ?? null,
      nextHash: contentHash,
      previousModel: saved?.embeddingModel ?? null,
      nextModel: embedding.model,
      previousVersion: saved?.embeddingVersion ?? null,
      nextVersion: embedding.version,
      hasEmbedding: Boolean(saved?.embedding?.length),
    });

    await db.insert(legalChunks).values({
      id: crypto.randomUUID(),
      legalDocumentId: input.documentId,
      provisionId,
      articleNumber: draft.articleNumber ?? null,
      paragraphNumber: draft.paragraphNumber ?? null,
      provisionType: draft.provisionType,
      provisionNumber: draft.provisionNumber ?? null,
      hierarchyPath: draft.hierarchyPath,
      heading: draft.heading ?? null,
      text: draft.sourceText,
      sourceText: draft.sourceText,
      retrievalText,
      normalizedSearchText,
      contentHash,
      embedding: reuse ? (saved?.embedding ?? null) : null,
      embeddingModel: reuse ? embedding.model : null,
      embeddingVersion: reuse ? embedding.version : null,
      language: input.parsed.language,
      sourceUrl: input.sourceUrl,
      pageNumber: draft.pageNumber ?? null,
      sequence: draft.sequence,
      textOrigin: draft.textOrigin,
      metadata: {
        ...(draft.metadata ?? {}),
        document_type: input.parsed.documentType,
        provision_type: draft.provisionType,
        provision_number: draft.provisionNumber ?? null,
        hierarchy_path: draft.hierarchyPath,
        language: input.parsed.language,
        country: "EG",
        authority_status: input.parsed.authorityStatus ?? null,
        content_type: draft.textOrigin,
        source_url: input.sourceUrl,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await refreshChunkSearchVectors(input.documentId);
  return drafts.length;
}
