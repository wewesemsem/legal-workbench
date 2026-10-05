import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documentPages, documents } from "@/lib/db/schema";
import {
  forbidden,
  notFound,
  validationError,
} from "@/modules/authorization/errors";
import {
  assertDocumentAccess,
  assertMatterAccess,
  canDeleteMatterDocument,
  canUploadToMatter,
  writeDocumentAudit,
  type AuthContext,
} from "@/modules/authorization/permissions";
import { getDocumentAiService } from "@/modules/document-ai";
import type { DocumentAiProcessResult } from "@/modules/document-ai/types";
import {
  sanitizeFilename,
  validateUploadFile,
} from "@/modules/documents/validation";
import { getObjectStorage } from "@/modules/storage";

const SAFE_PROCESS_ERROR =
  "We couldn't process this document. Please try again.";

type RagReadyMetadata = {
  domain: "customer_matter_data";
  workspaceId: string;
  matterId: string;
  documentId: string;
  documentName: string;
  pageCount: number;
  captureKind?: "file" | "multi_photo";
  pageStorageKeys?: string[];
  pages: Array<{
    pageNumber: number;
    paragraphCount: number;
    tableCount: number;
  }>;
};

function publicDocument(row: typeof documents.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    matterId: row.matterId,
    uploadedBy: row.uploadedBy,
    filename: row.filename,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    processingStatus: row.processingStatus,
    processingError: row.processingError,
    pageCount: row.pageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asRagMetadata(
  value: Record<string, unknown> | null | undefined,
): Partial<RagReadyMetadata> {
  return (value ?? {}) as Partial<RagReadyMetadata>;
}

export async function listMatterDocuments(input: {
  matterId: string;
  context: AuthContext;
}) {
  await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.matterId, input.matterId))
    .orderBy(asc(documents.createdAt));

  return rows.map(publicDocument);
}

export async function getMatterDocument(input: {
  documentId: string;
  context: AuthContext;
  includeExtractedText?: boolean;
}) {
  const access = await assertDocumentAccess({
    documentId: input.documentId,
    context: input.context,
  });

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);
  const document = rows[0];
  if (!document) {
    throw notFound("Document not found");
  }

  const pages = await listDocumentPagesInternal(input.documentId);

  await writeDocumentAudit({
    documentId: document.id,
    workspaceId: document.workspaceId,
    matterId: document.matterId,
    actorUserId: input.context.userId,
    action: "document.view",
    metadata: { pageCount: pages.length },
  });

  return {
    document: {
      ...publicDocument(document),
      extractedText: input.includeExtractedText
        ? document.extractedText
        : undefined,
      ragReadyMetadata: document.ragReadyMetadata,
    },
    pages,
    access,
  };
}

export async function listDocumentPages(input: {
  documentId: string;
  context: AuthContext;
}) {
  await assertDocumentAccess({
    documentId: input.documentId,
    context: input.context,
  });

  return listDocumentPagesInternal(input.documentId);
}

async function listDocumentPagesInternal(documentId: string) {
  return db
    .select({
      id: documentPages.id,
      pageNumber: documentPages.pageNumber,
      extractedText: documentPages.extractedText,
      width: documentPages.width,
      height: documentPages.height,
      layoutData: documentPages.layoutData,
      metadata: documentPages.metadata,
    })
    .from(documentPages)
    .where(eq(documentPages.documentId, documentId))
    .orderBy(asc(documentPages.pageNumber));
}

export async function getDocumentOriginalBytes(input: {
  documentId: string;
  context: AuthContext;
}) {
  const documentRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);
  const document = documentRows[0];
  if (!document) {
    throw notFound("Document not found");
  }

  await assertMatterAccess({
    matterId: document.matterId,
    context: input.context,
  });

  const object = await getObjectStorage().getObject(document.storageLocation);

  await writeDocumentAudit({
    documentId: document.id,
    workspaceId: document.workspaceId,
    matterId: document.matterId,
    actorUserId: input.context.userId,
    action: "document.download_original",
  });

  return {
    filename: document.originalFilename,
    mimeType: document.mimeType,
    body: object.body,
  };
}

async function persistProcessedResult(input: {
  documentId: string;
  matterId: string;
  workspaceId: string;
  filename: string;
  result: DocumentAiProcessResult;
  captureKind?: "file" | "multi_photo";
  pageStorageKeys?: string[];
}) {
  await db.delete(documentPages).where(eq(documentPages.documentId, input.documentId));

  if (input.result.pages.length > 0) {
    await db.insert(documentPages).values(
      input.result.pages.map((page, index) => ({
        id: crypto.randomUUID(),
        documentId: input.documentId,
        pageNumber: page.pageNumber,
        extractedText: page.text,
        layoutData: page.layout,
        width: page.width ?? null,
        height: page.height ?? null,
        metadata: page.metadata,
        storageLocation: input.pageStorageKeys?.[index] ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }

  const ragReadyMetadata: RagReadyMetadata = {
    domain: "customer_matter_data",
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    documentId: input.documentId,
    documentName: input.filename,
    pageCount: input.result.pageCount,
    captureKind: input.captureKind ?? "file",
    pageStorageKeys: input.pageStorageKeys,
    // Future Matter RAG can chunk from pages/paragraphs here.
    pages: input.result.pages.map((page) => ({
      pageNumber: page.pageNumber,
      paragraphCount: page.layout.paragraphs.length,
      tableCount: page.layout.tables.length,
    })),
  };

  await db
    .update(documents)
    .set({
      processingStatus: "PROCESSED",
      processingError: null,
      pageCount: input.result.pageCount,
      extractedText: input.result.fullText,
      ragReadyMetadata,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, input.documentId));

  try {
    const { indexMatterDocument } = await import("@/modules/matter-rag/index-document");
    await indexMatterDocument(input.documentId);
  } catch (error) {
    console.error("[documents] matter RAG indexing failed", {
      documentId: input.documentId,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  }
}

async function markFailed(documentId: string, error: unknown) {
  await db
    .update(documents)
    .set({
      processingStatus: "FAILED",
      processingError: SAFE_PROCESS_ERROR,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  console.error("[documents] processing failed", {
    documentId,
    // Never log document contents.
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : "unknown",
  });
}

async function runDocumentAiForStoredObject(input: {
  document: typeof documents.$inferSelect;
}) {
  const meta = asRagMetadata(input.document.ragReadyMetadata);
  const pageKeys = meta.pageStorageKeys?.filter(Boolean) ?? [];
  const ai = getDocumentAiService();
  const storage = getObjectStorage();

  if (meta.captureKind === "multi_photo" && pageKeys.length > 0) {
    const mergedPages = [];
    let provider: "mock" | "google" = "mock";

    for (const [index, key] of pageKeys.entries()) {
      const object = await storage.getObject(key);
      const result = await ai.processDocument({
        content: object.body,
        mimeType: object.contentType || input.document.mimeType,
        filename: `${input.document.originalFilename}-page-${index + 1}`,
      });
      provider = result.provider;
      const first = result.pages[0];
      mergedPages.push({
        pageNumber: index + 1,
        text: first?.text || result.fullText,
        width: first?.width,
        height: first?.height,
        layout: first?.layout || {
          paragraphs: [result.fullText],
          tables: [],
          blocks: [],
        },
        metadata: {
          ...(first?.metadata ?? {}),
          sourcePageStorageKey: key,
        },
      });
    }

    return {
      result: {
        fullText: mergedPages.map((page) => page.text).join("\n\n"),
        pageCount: mergedPages.length,
        pages: mergedPages,
        provider,
        rawSummary: { multiPagePhoto: true },
      } satisfies DocumentAiProcessResult,
      captureKind: "multi_photo" as const,
      pageStorageKeys: pageKeys,
    };
  }

  const object = await storage.getObject(input.document.storageLocation);
  const result = await ai.processDocument({
    content: object.body,
    mimeType: input.document.mimeType,
    filename: input.document.originalFilename,
  });

  return {
    result,
    captureKind: "file" as const,
    pageStorageKeys: undefined,
  };
}

export async function processDocument(input: {
  documentId: string;
  context?: AuthContext;
  throwOnFailure?: boolean;
}) {
  const throwOnFailure = input.throwOnFailure !== false;
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);
  const document = rows[0];
  if (!document) {
    throw notFound("Document not found");
  }

  if (input.context) {
    await assertMatterAccess({
      matterId: document.matterId,
      context: input.context,
    });
  }

  await db
    .update(documents)
    .set({
      processingStatus: "PROCESSING",
      processingError: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, document.id));

  try {
    const processed = await runDocumentAiForStoredObject({ document });

    await persistProcessedResult({
      documentId: document.id,
      matterId: document.matterId,
      workspaceId: document.workspaceId,
      filename: document.originalFilename,
      result: processed.result,
      captureKind: processed.captureKind,
      pageStorageKeys: processed.pageStorageKeys,
    });

    if (input.context) {
      await writeDocumentAudit({
        documentId: document.id,
        workspaceId: document.workspaceId,
        matterId: document.matterId,
        actorUserId: input.context.userId,
        action: "document.processed",
        metadata: {
          pageCount: processed.result.pageCount,
          provider: processed.result.provider,
        },
      });
    }

    return {
      status: "PROCESSED" as const,
      pageCount: processed.result.pageCount,
    };
  } catch (error) {
    await markFailed(document.id, error);
    if (throwOnFailure) {
      throw validationError(SAFE_PROCESS_ERROR);
    }
    return { status: "FAILED" as const, pageCount: document.pageCount };
  }
}

export async function uploadMatterDocument(input: {
  matterId: string;
  context: AuthContext;
  originalFilename: string;
  claimedMimeType?: string | null;
  content: Buffer;
  processInline?: boolean;
}) {
  const access = await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  if (!canUploadToMatter(access.memberRole)) {
    throw forbidden("You cannot upload documents to this matter");
  }

  const validated = validateUploadFile({
    originalFilename: input.originalFilename,
    claimedMimeType: input.claimedMimeType,
    content: input.content,
  });

  const documentId = crypto.randomUUID();
  const safeName = sanitizeFilename(input.originalFilename);
  const storageKey = [
    "matters",
    access.workspaceId,
    access.matterId,
    "documents",
    documentId,
    "original",
    safeName,
  ].join("/");

  await getObjectStorage().putObject({
    key: storageKey,
    body: input.content,
    contentType: validated.mimeType,
  });

  const now = new Date();
  const initialMetadata: RagReadyMetadata = {
    domain: "customer_matter_data",
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    documentId,
    documentName: input.originalFilename,
    pageCount: 0,
    captureKind: "file",
    pages: [],
  };

  await db.insert(documents).values({
    id: documentId,
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    uploadedBy: input.context.userId,
    filename: safeName,
    originalFilename: input.originalFilename,
    mimeType: validated.mimeType,
    fileSize: validated.fileSize,
    storageLocation: storageKey,
    processingStatus: "UPLOADED",
    ragReadyMetadata: initialMetadata,
    createdAt: now,
    updatedAt: now,
  });

  await writeDocumentAudit({
    documentId,
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    actorUserId: input.context.userId,
    action: "document.uploaded",
    metadata: {
      mimeType: validated.mimeType,
      fileSize: validated.fileSize,
    },
  });

  if (input.processInline !== false) {
    await processDocument({
      documentId,
      context: input.context,
      throwOnFailure: false,
    });
  }

  const refreshed = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  return publicDocument(refreshed[0]!);
}

/**
 * Multi-page photo capture: each image becomes a page; originals stored per page
 * and a primary storage location points at page 1.
 */
export async function uploadMatterPhotoPages(input: {
  matterId: string;
  context: AuthContext;
  title?: string;
  pages: Array<{
    originalFilename: string;
    claimedMimeType?: string | null;
    content: Buffer;
  }>;
}) {
  const access = await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  if (!canUploadToMatter(access.memberRole)) {
    throw forbidden("You cannot upload documents to this matter");
  }

  if (!input.pages.length) {
    throw validationError("At least one page is required");
  }

  if (input.pages.length > 30) {
    throw validationError("A maximum of 30 pages can be uploaded at once");
  }

  const validatedPages = input.pages.map((page, index) => {
    const validated = validateUploadFile({
      originalFilename: page.originalFilename || `page-${index + 1}.jpg`,
      claimedMimeType: page.claimedMimeType,
      content: page.content,
    });
    if (!validated.mimeType.startsWith("image/")) {
      throw validationError("Photo capture pages must be images");
    }
    return { ...page, validated };
  });

  const documentId = crypto.randomUUID();
  const title = sanitizeFilename(input.title || `scan-${Date.now()}.pdf`);
  const now = new Date();
  const storage = getObjectStorage();
  const pageKeys: string[] = [];

  for (const [index, page] of validatedPages.entries()) {
    const key = [
      "matters",
      access.workspaceId,
      access.matterId,
      "documents",
      documentId,
      "pages",
      `page-${index + 1}.${page.validated.extension}`,
    ].join("/");
    await storage.putObject({
      key,
      body: page.content,
      contentType: page.validated.mimeType,
    });
    pageKeys.push(key);
  }

  const initialMetadata: RagReadyMetadata = {
    domain: "customer_matter_data",
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    documentId,
    documentName: title,
    pageCount: pageKeys.length,
    captureKind: "multi_photo",
    pageStorageKeys: pageKeys,
    pages: [],
  };

  await db.insert(documents).values({
    id: documentId,
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    uploadedBy: input.context.userId,
    filename: title,
    originalFilename: title,
    mimeType: validatedPages[0]!.validated.mimeType,
    fileSize: validatedPages.reduce(
      (sum, page) => sum + page.validated.fileSize,
      0,
    ),
    storageLocation: pageKeys[0]!,
    processingStatus: "UPLOADED",
    ragReadyMetadata: initialMetadata,
    createdAt: now,
    updatedAt: now,
  });

  await writeDocumentAudit({
    documentId,
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    actorUserId: input.context.userId,
    action: "document.photo_pages_uploaded",
    metadata: { pageCount: validatedPages.length },
  });

  await processDocument({
    documentId,
    context: input.context,
    throwOnFailure: false,
  });

  const refreshed = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  return publicDocument(refreshed[0]!);
}

export async function retryDocumentProcessing(input: {
  documentId: string;
  context: AuthContext;
}) {
  const document = await assertDocumentAccess({
    documentId: input.documentId,
    context: input.context,
  });

  if (
    document.processingStatus !== "FAILED" &&
    document.processingStatus !== "UPLOADED"
  ) {
    throw validationError("Only failed or uploaded documents can be retried");
  }

  return processDocument({
    documentId: input.documentId,
    context: input.context,
    throwOnFailure: true,
  });
}

export async function deleteMatterDocument(input: {
  documentId: string;
  context: AuthContext;
}) {
  const access = await assertDocumentAccess({
    documentId: input.documentId,
    context: input.context,
  });

  if (!canDeleteMatterDocument(access.memberRole)) {
    throw forbidden("You are not allowed to delete this document");
  }

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);
  const document = rows[0];
  if (!document) {
    throw notFound("Document not found");
  }

  const pages = await db
    .select({
      storageLocation: documentPages.storageLocation,
    })
    .from(documentPages)
    .where(eq(documentPages.documentId, input.documentId));

  const meta = asRagMetadata(document.ragReadyMetadata);
  const keys = new Set<string>();
  keys.add(document.storageLocation);
  for (const key of meta.pageStorageKeys ?? []) {
    keys.add(key);
  }
  for (const page of pages) {
    if (page.storageLocation) {
      keys.add(page.storageLocation);
    }
  }

  const storage = getObjectStorage();
  for (const key of keys) {
    try {
      await storage.deleteObject(key);
    } catch (error) {
      console.error("[documents] storage delete failed", {
        documentId: document.id,
        errorName: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  await writeDocumentAudit({
    documentId: document.id,
    workspaceId: document.workspaceId,
    matterId: document.matterId,
    actorUserId: input.context.userId,
    action: "document.deleted",
    metadata: {
      filename: document.originalFilename,
      mimeType: document.mimeType,
    },
  });

  // Remove pages explicitly, then document. Audit row survives via ON DELETE SET NULL.
  await db.delete(documentPages).where(eq(documentPages.documentId, document.id));
  await db.delete(documents).where(eq(documents.id, document.id));

  return { deleted: true as const, documentId: document.id };
}
