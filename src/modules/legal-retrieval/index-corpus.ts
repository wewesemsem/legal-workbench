import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { legalChunks, legalDocuments, legalProvisions } from "@/lib/db/schema";
import { sha256Hex } from "@/modules/legal-corpus/checksum";
import {
  ancestorsOf,
  linkStoredProvisions,
  type HierarchyNode,
} from "@/modules/legal-corpus/hierarchy";
import type { ParsedProvision } from "@/modules/legal-corpus/types";
import { buildNormalizedSearchText } from "@/modules/legal-retrieval/arabic-normalize";
import { getLegalEmbeddingConfig, getLegalRetrievalConfig } from "@/modules/legal-retrieval/config";
import { getLegalEmbeddingService } from "@/modules/legal-retrieval/embedding-service";
import { canReuseEmbedding } from "@/modules/legal-retrieval/hybrid-rank";
import { refreshChunkSearchVectors } from "@/modules/legal-retrieval/repository";
import { buildRetrievalText } from "@/modules/legal-retrieval/retrieval-text";

type StoredRow = typeof legalProvisions.$inferSelect;

function toParsed(row: StoredRow): ParsedProvision {
  return {
    provisionType: row.provisionType,
    provisionNumber: row.provisionNumber ?? undefined,
    heading: row.heading ?? undefined,
    text: row.text,
    sequence: row.sequence,
    pageNumber: row.pageNumber ?? undefined,
    textOrigin: row.textOrigin,
    metadata: row.metadata ?? undefined,
  };
}

export async function syncLegalRetrievalIndex(documentId: string) {
  const [document] = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.id, documentId))
    .limit(1);
  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const loaded = await db
    .select()
    .from(legalProvisions)
    .where(eq(legalProvisions.legalDocumentId, documentId))
    .orderBy(asc(legalProvisions.sequence));
  const duplicateChildIds = loaded
    .filter((row) => {
      if (row.provisionType !== "PARAGRAPH" && row.provisionType !== "CLAUSE") {
        return false;
      }
      const parent = loaded.find((item) => item.id === row.parentId);
      if (!parent || parent.provisionType !== "ARTICLE") {
        return false;
      }
      const siblings = loaded.filter(
        (item) =>
          item.parentId === row.parentId &&
          (item.provisionType === "PARAGRAPH" || item.provisionType === "CLAUSE"),
      );
      return siblings.length === 1 && row.text === parent.text;
    })
    .map((row) => row.id);
  if (duplicateChildIds.length) {
    await db
      .delete(legalProvisions)
      .where(inArray(legalProvisions.id, duplicateChildIds));
  }
  const provisions = loaded.filter((row) => !duplicateChildIds.includes(row.id));
  const originalText = new Map(provisions.map((row) => [row.id, row.text]));
  const links = linkStoredProvisions(
    document.documentType,
    provisions.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      provisionType: row.provisionType,
      provisionNumber: row.provisionNumber,
      heading: row.heading,
      sequence: row.sequence,
    })),
  );

  await db
    .update(legalProvisions)
    .set({ hierarchyPath: null, updatedAt: new Date() })
    .where(eq(legalProvisions.legalDocumentId, documentId));

  for (const row of provisions) {
    const link = links.get(row.id);
    if (!link) {
      continue;
    }
    await db
      .update(legalProvisions)
      .set({
        parentId: link.parentId,
        hierarchyPath: link.hierarchyPath,
        title: link.title,
        updatedAt: new Date(),
      })
      .where(eq(legalProvisions.id, row.id));
  }

  const unchanged = await db
    .select({ id: legalProvisions.id, text: legalProvisions.text })
    .from(legalProvisions)
    .where(eq(legalProvisions.legalDocumentId, documentId));
  for (const row of unchanged) {
    if (row.text !== originalText.get(row.id)) {
      throw new Error("Legal source text changed during hierarchy indexing");
    }
  }

  const linked = provisions.map((row) => {
    const link = links.get(row.id);
    return {
      ...row,
      parentId: link?.parentId ?? row.parentId,
      hierarchyPath: link?.hierarchyPath ?? row.hierarchyPath,
      title: link?.title ?? row.title,
    };
  });

  const pathToRow = new Map(
    linked
      .filter((row) => row.hierarchyPath)
      .map((row) => [row.hierarchyPath as string, row]),
  );
  const nodes: HierarchyNode[] = linked
    .filter((row) => row.hierarchyPath)
    .map((row) => ({
      provision: toParsed(row),
      hierarchyPath: row.hierarchyPath as string,
      parentHierarchyPath: row.parentId
        ? (linked.find((item) => item.id === row.parentId)?.hierarchyPath ?? null)
        : null,
    }));

  const config = getLegalRetrievalConfig();
  const embeddingConfig = getLegalEmbeddingConfig();
  const existingChunks = await db
    .select()
    .from(legalChunks)
    .where(eq(legalChunks.legalDocumentId, documentId));
  const existingByPath = new Map(
    existingChunks
      .filter((chunk) => chunk.hierarchyPath)
      .map((chunk) => [chunk.hierarchyPath as string, chunk]),
  );

  const chunkPlans = nodes
    .filter((node) => {
      const type = node.provision.provisionType;
      return type === "ARTICLE" || type === "OTHER";
    })
    .map((node) => {
      const children = nodes.filter(
        (candidate) =>
          candidate.parentHierarchyPath === node.hierarchyPath &&
          (candidate.provision.provisionType === "PARAGRAPH" ||
            candidate.provision.provisionType === "CLAUSE"),
      );
      const split = node.provision.text.length > config.chunkMaxChars && children.length > 1;
      return split ? children : [node];
    })
    .flat()
    .map((node, index) => {
      const row = pathToRow.get(node.hierarchyPath);
      const articleAncestor = ancestorsOf(nodes, node).find(
        (ancestor) => ancestor.provision.provisionType === "ARTICLE",
      );
      const retrievalText = buildRetrievalText({
        documentTitle: document.title,
        documentType: document.documentType,
        ancestors: ancestorsOf(nodes, node).map((ancestor) => ({
          provisionType: ancestor.provision.provisionType,
          heading: ancestor.provision.heading,
          provisionNumber: ancestor.provision.provisionNumber,
        })),
        provisionType: node.provision.provisionType,
        provisionNumber: node.provision.provisionNumber,
        heading: node.provision.heading,
        sourceText: node.provision.text,
      });
      return {
        sequence: index + 1,
        provisionId: row?.id,
        hierarchyPath: node.hierarchyPath,
        provisionType: node.provision.provisionType,
        provisionNumber: node.provision.provisionNumber ?? null,
        articleNumber:
          node.provision.provisionType === "ARTICLE"
            ? (node.provision.provisionNumber ?? null)
            : (articleAncestor?.provision.provisionNumber ?? null),
        paragraphNumber:
          node.provision.provisionType === "PARAGRAPH" ||
          node.provision.provisionType === "CLAUSE"
            ? (node.provision.provisionNumber ?? null)
            : null,
        heading: node.provision.heading ?? null,
        sourceText: node.provision.text,
        retrievalText,
        normalizedSearchText: buildNormalizedSearchText(retrievalText),
        contentHash: sha256Hex(retrievalText),
        pageNumber: node.provision.pageNumber ?? null,
        textOrigin: node.provision.textOrigin,
      };
    })
    .filter((plan) => plan.provisionId);

  const toEmbed: typeof chunkPlans = [];
  let reused = 0;
  for (const plan of chunkPlans) {
    const previous = existingByPath.get(plan.hierarchyPath);
    if (
      previous &&
      canReuseEmbedding({
        previousHash: previous.contentHash,
        nextHash: plan.contentHash,
        previousModel: previous.embeddingModel,
        nextModel: embeddingConfig.model,
        previousVersion: previous.embeddingVersion,
        nextVersion: embeddingConfig.version,
        hasEmbedding: Boolean(previous.embedding?.length),
      })
    ) {
      reused += 1;
      continue;
    }
    toEmbed.push(plan);
  }

  const embedded = await getLegalEmbeddingService().embedTexts(
    toEmbed.map((plan) => plan.retrievalText),
  );
  const vectorByPath = new Map(
    toEmbed.map((plan, index) => [plan.hierarchyPath, embedded.vectors[index]]),
  );

  const keepPaths = new Set(chunkPlans.map((plan) => plan.hierarchyPath));
  for (const chunk of existingChunks) {
    if (!chunk.hierarchyPath || !keepPaths.has(chunk.hierarchyPath)) {
      await db.delete(legalChunks).where(eq(legalChunks.id, chunk.id));
    }
  }

  for (const plan of chunkPlans) {
    const previous = existingByPath.get(plan.hierarchyPath);
    const reuse = !vectorByPath.has(plan.hierarchyPath);
    const embedding = reuse ? (previous?.embedding ?? null) : (vectorByPath.get(plan.hierarchyPath) ?? null);
    const values = {
      legalDocumentId: documentId,
      provisionId: plan.provisionId!,
      articleNumber: plan.articleNumber,
      paragraphNumber: plan.paragraphNumber,
      provisionType: plan.provisionType,
      provisionNumber: plan.provisionNumber,
      hierarchyPath: plan.hierarchyPath,
      heading: plan.heading,
      text: plan.sourceText,
      sourceText: plan.sourceText,
      retrievalText: plan.retrievalText,
      normalizedSearchText: plan.normalizedSearchText,
      contentHash: plan.contentHash,
      embedding,
      embeddingModel: embedding ? embeddingConfig.model : null,
      embeddingVersion: embedding ? embeddingConfig.version : null,
      language: document.language,
      sourceUrl: document.sourceUrl,
      pageNumber: plan.pageNumber,
      sequence: plan.sequence,
      textOrigin: plan.textOrigin,
      metadata: {
        document_type: document.documentType,
        provision_type: plan.provisionType,
        provision_number: plan.provisionNumber,
        hierarchy_path: plan.hierarchyPath,
        language: document.language,
        country: document.country,
        jurisdiction: document.jurisdiction,
        authority_status: document.authorityStatus,
        content_type: plan.textOrigin,
        source_url: document.sourceUrl,
      },
      updatedAt: new Date(),
    };
    if (previous && keepPaths.has(plan.hierarchyPath)) {
      await db.update(legalChunks).set(values).where(eq(legalChunks.id, previous.id));
      continue;
    }
    await db.insert(legalChunks).values({
      id: crypto.randomUUID(),
      ...values,
      createdAt: new Date(),
    });
  }

  await refreshChunkSearchVectors(documentId);

  return {
    documentId,
    provisions: provisions.length,
    chunks: chunkPlans.length,
    embedded: toEmbed.length,
    reused,
    embeddingModel: embeddingConfig.model,
    embeddingVersion: embeddingConfig.version,
  };
}

export async function indexApprovedAuthoritativeDocuments() {
  const documents = await db
    .select({ id: legalDocuments.id })
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.authorityStatus, "AUTHORITATIVE_SOURCE"),
        eq(legalDocuments.reviewStatus, "APPROVED"),
      ),
    );
  const results = [];
  for (const document of documents) {
    results.push(await syncLegalRetrievalIndex(document.id));
  }
  return results;
}
