import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { documentPages, documents, matterDocumentChunks } from "@/lib/db/schema";
import { getLegalEmbeddingService } from "@/modules/legal-retrieval/embedding-service";
import { chunkPageText } from "@/modules/matter-rag/chunk";

function contentHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Index one processed matter document into Matter RAG chunks + embeddings.
 * Completely separate from the public legal corpus.
 */
export async function indexMatterDocument(documentId: string): Promise<{
  documentId: string;
  chunkCount: number;
}> {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  const document = rows[0];
  if (!document || document.processingStatus !== "PROCESSED") {
    return { documentId, chunkCount: 0 };
  }

  const pages = await db
    .select()
    .from(documentPages)
    .where(eq(documentPages.documentId, documentId));

  const pageSources =
    pages.length > 0
      ? pages.map((page) => ({
          pageId: page.id,
          pageNumber: page.pageNumber,
          text: page.extractedText ?? "",
        }))
      : [
          {
            pageId: null as string | null,
            pageNumber: 1,
            text: document.extractedText ?? "",
          },
        ];

  const prepared = pageSources.flatMap((page) =>
    chunkPageText({
      pageNumber: page.pageNumber,
      pageId: page.pageId,
      text: page.text,
    }),
  );

  await db
    .delete(matterDocumentChunks)
    .where(eq(matterDocumentChunks.documentId, documentId));

  if (!prepared.length) {
    return { documentId, chunkCount: 0 };
  }

  const embedder = getLegalEmbeddingService();
  const embedded = await embedder.embedTexts(prepared.map((chunk) => chunk.text));
  const now = new Date();

  const values = prepared.map((chunk, index) => ({
    id: crypto.randomUUID(),
    workspaceId: document.workspaceId,
    matterId: document.matterId,
    documentId: document.id,
    pageId: chunk.pageId,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    contentHash: chunk.contentHash || contentHash(chunk.text),
    embedding: embedded.vectors[index] ?? null,
    embeddingModel: embedded.model,
    embeddingVersion: embedded.version,
    metadata: {
      domain: "customer_matter_data",
      filename: document.originalFilename,
    },
    createdAt: now,
    updatedAt: now,
  }));

  // Insert in batches to avoid oversized payloads.
  for (let i = 0; i < values.length; i += 50) {
    await db.insert(matterDocumentChunks).values(values.slice(i, i + 50));
  }

  await db.execute(sql`
    UPDATE matter_document_chunks
    SET search_vector = to_tsvector('simple', coalesce(text, ''))
    WHERE document_id = ${documentId}
  `);

  return { documentId, chunkCount: values.length };
}

export async function indexMatterDocumentsForMatter(matterId: string) {
  const docs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(eq(documents.matterId, matterId), eq(documents.processingStatus, "PROCESSED")),
    );
  let total = 0;
  for (const doc of docs) {
    const result = await indexMatterDocument(doc.id);
    total += result.chunkCount;
  }
  return { documentCount: docs.length, chunkCount: total };
}
