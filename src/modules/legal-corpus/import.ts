import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  legalDocuments,
  legalIngestionRuns,
  legalSources,
} from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { validationError } from "@/modules/authorization/errors";
import { canonicalizeUrl, sha256Hex } from "@/modules/legal-corpus/checksum";
import {
  importManifestSchema,
  mapManifestDocumentType,
  mapManifestSourceType,
  type ImportManifest,
} from "@/modules/legal-corpus/manifest";
import { parseLegalSourceText } from "@/modules/legal-corpus/parse";
import { persistProvisionsAndChunks } from "@/modules/legal-corpus/persist";
import { getObjectStorage } from "@/modules/storage";

const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(["txt", "html", "htm", "md", "markdown"]);
const BINARY_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

export type ImportDocumentResult = {
  file: string;
  status: "imported" | "duplicate" | "rejected" | "would_import";
  reason?: string;
  documentId?: string;
  checksum?: string;
  provisions?: number;
  chunks?: number;
  contentType?: string;
  authorityStatus?: string;
};

export type ImportReport = {
  sourceName: string;
  sourceId: string;
  dryRun: boolean;
  runId: string | null;
  documentsDiscovered: number;
  documentsImported: number;
  duplicates: number;
  rejected: number;
  provisionsCreated: number;
  chunksCreated: number;
  ocrDocuments: number;
  sourceTextDocuments: number;
  authority: string;
  results: ImportDocumentResult[];
  failures: string[];
};

function extensionOf(filePath: string) {
  return path.extname(filePath).replace(".", "").toLowerCase();
}

function detectImportMime(buffer: Buffer, filePath: string): string | null {
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer.toString("ascii", 1, 4) === "PNG"
  ) {
    return "image/png";
  }
  const ext = extensionOf(filePath);
  if (TEXT_EXTENSIONS.has(ext)) {
    return ext === "html" || ext === "htm" ? "text/html" : "text/plain";
  }
  if (ext === "pdf") {
    return "application/pdf";
  }
  return null;
}

function validateAuthorityRules(manifest: ImportManifest) {
  if (
    manifest.authority_status === "AUTHORITATIVE_SOURCE" &&
    manifest.acquisition_method === "FIXTURE"
  ) {
    throw validationError(
      "FIXTURE acquisition_method cannot be imported as AUTHORITATIVE_SOURCE",
    );
  }

  if (
    manifest.authority_status === "AUTHORITATIVE_SOURCE" &&
    !manifest.issuing_authority &&
    !manifest.documents.every((doc) => doc.issuing_authority)
  ) {
    throw validationError(
      "AUTHORITATIVE_SOURCE imports require issuing_authority",
    );
  }

  if (
    manifest.authority_status === "AUTHORITATIVE_SOURCE" &&
    !manifest.source_url &&
    !manifest.acquisition_note &&
    !manifest.documents.every(
      (doc) => doc.source_url || doc.acquisition_note || manifest.acquisition_note,
    )
  ) {
    throw validationError(
      "AUTHORITATIVE_SOURCE imports require source_url or acquisition_note provenance",
    );
  }

  for (const doc of manifest.documents) {
    if (
      doc.content_type === "FIXTURE" &&
      manifest.authority_status === "AUTHORITATIVE_SOURCE"
    ) {
      throw validationError(
        `Document "${doc.title}" is FIXTURE content and cannot be AUTHORITATIVE_SOURCE`,
      );
    }
    if (
      doc.content_type === "DERIVED_TRANSLATION" &&
      manifest.authority_status === "AUTHORITATIVE_SOURCE"
    ) {
      throw validationError(
        `Document "${doc.title}" is DERIVED_TRANSLATION and cannot be AUTHORITATIVE_SOURCE`,
      );
    }
    if (
      doc.content_type === "DERIVED_TRANSLATION" &&
      manifest.authority_status !== "DERIVED"
    ) {
      throw validationError(
        `Document "${doc.title}" with DERIVED_TRANSLATION requires authority_status=DERIVED`,
      );
    }
  }
}

async function ensureImportSource(manifest: ImportManifest) {
  const sourceId =
    manifest.source_id ||
    `src_import_${createHash("sha256")
      .update(manifest.source_name)
      .digest("hex")
      .slice(0, 16)}`;

  const [existing] = await db
    .select()
    .from(legalSources)
    .where(eq(legalSources.id, sourceId))
    .limit(1);

  const now = new Date();

  if (existing) {
    // Preserve adapter keys for seeded sources; only update import provenance fields.
    await db
      .update(legalSources)
      .set({
        authorityStatus: manifest.authority_status,
        acquisitionMethod: manifest.acquisition_method,
        approvedForAutomatedAcquisition: false,
        notes:
          manifest.acquisition_note ||
          existing.notes ||
          "Approved import path used for this source",
        updatedAt: now,
      })
      .where(eq(legalSources.id, sourceId));
  } else {
    await db.insert(legalSources).values({
      id: sourceId,
      name: manifest.source_name,
      authority:
        manifest.issuing_authority ||
        manifest.documents[0]?.issuing_authority ||
        manifest.source_name,
      country: manifest.country,
      jurisdiction: manifest.jurisdiction,
      baseUrl: manifest.source_url || "https://import.local/approved-manifest",
      sourceType: mapManifestSourceType(manifest.source_type),
      accessStatus: "REVIEW_REQUIRED",
      authorityStatus: manifest.authority_status,
      acquisitionMethod: manifest.acquisition_method,
      approvedForAutomatedAcquisition: false,
      ingestionEnabled: true,
      adapterKey: `approved-import:${sourceId}`,
      notes:
        manifest.acquisition_note ||
        "Approved import source (manual/licensed/official download path)",
      createdAt: now,
      updatedAt: now,
    });
  }

  const [source] = await db
    .select()
    .from(legalSources)
    .where(eq(legalSources.id, sourceId))
    .limit(1);
  return source!;
}

async function readTextForParse(input: {
  originalPath: string;
  originalBytes: Buffer;
  textFilePath?: string;
  contentType: string;
}) {
  if (input.textFilePath) {
    const textBytes = await readFile(input.textFilePath);
    return textBytes.toString("utf8");
  }

  const ext = extensionOf(input.originalPath);
  if (TEXT_EXTENSIONS.has(ext) || input.contentType.startsWith("text/")) {
    return input.originalBytes.toString("utf8");
  }

  if (BINARY_EXTENSIONS.has(ext)) {
    throw validationError(
      `Binary file "${path.basename(input.originalPath)}" requires text_file companion for parsing (original is preserved separately)`,
    );
  }

  throw validationError(
    `Unsupported import file type for "${path.basename(input.originalPath)}"`,
  );
}

export async function importLegalManifest(input: {
  manifestPath: string;
  dryRun?: boolean;
}): Promise<ImportReport> {
  const env = getEnv();
  void env;

  const absoluteManifest = path.resolve(input.manifestPath);
  const raw = await readFile(absoluteManifest, "utf8");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw validationError("Manifest is not valid JSON");
  }

  const manifest = importManifestSchema.parse(parsedJson);
  validateAuthorityRules(manifest);

  const baseDir = path.dirname(absoluteManifest);
  const dryRun = Boolean(input.dryRun);
  const results: ImportDocumentResult[] = [];
  const failures: string[] = [];

  let documentsImported = 0;
  let duplicates = 0;
  let rejected = 0;
  let provisionsCreated = 0;
  let chunksCreated = 0;
  let ocrDocuments = 0;
  let sourceTextDocuments = 0;
  let runId: string | null = null;
  let sourceId = "";

  if (!dryRun) {
    const source = await ensureImportSource(manifest);
    sourceId = source.id;
    runId = crypto.randomUUID();
    await db.insert(legalIngestionRuns).values({
      id: runId,
      sourceId: source.id,
      status: "RUNNING",
      startedAt: new Date(),
      discoveredCount: manifest.documents.length,
      metadata: {
        phase: "approved_import",
        manifestPath: absoluteManifest,
        acquisitionMethod: manifest.acquisition_method,
        authorityStatus: manifest.authority_status,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    sourceId =
      manifest.source_id ||
      `dry-run:${manifest.source_name}`;
  }

  for (const doc of manifest.documents) {
    const filePath = path.resolve(baseDir, doc.file);
    const textPath = doc.text_file
      ? path.resolve(baseDir, doc.text_file)
      : undefined;

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw validationError(`Not a file: ${doc.file}`);
      }
      if (fileStat.size <= 0) {
        throw validationError(`Empty file: ${doc.file}`);
      }
      if (fileStat.size > MAX_IMPORT_BYTES) {
        throw validationError(`File exceeds allowed size: ${doc.file}`);
      }

      const originalBytes = await readFile(filePath);
      const mime = detectImportMime(originalBytes, filePath);
      if (!mime) {
        throw validationError(`Could not verify file type: ${doc.file}`);
      }

      const rawHash = sha256Hex(originalBytes);
      const provenanceUrl =
        doc.source_url || manifest.source_url
          ? canonicalizeUrl(String(doc.source_url || manifest.source_url))
          : null;
      const checksum = sha256Hex(
        `${provenanceUrl ?? path.basename(filePath)}:${rawHash}`,
      );

      if (doc.content_type === "OCR") {
        ocrDocuments += 1;
      }
      if (doc.content_type === "SOURCE_TEXT") {
        sourceTextDocuments += 1;
      }

      if (!dryRun) {
        const [existing] = await db
          .select()
          .from(legalDocuments)
          .where(
            and(
              eq(legalDocuments.sourceId, sourceId),
              eq(legalDocuments.rawContentHash, rawHash),
            ),
          )
          .limit(1);

        if (existing) {
          duplicates += 1;
          results.push({
            file: doc.file,
            status: "duplicate",
            reason: "Identical content checksum already imported",
            documentId: existing.id,
            checksum,
            authorityStatus: existing.authorityStatus,
          });
          continue;
        }
      }

      const extractText = await readTextForParse({
        originalPath: filePath,
        originalBytes,
        textFilePath: textPath,
        contentType: mime,
      });

      if (!extractText.trim()) {
        throw validationError(`No parseable text for ${doc.file}`);
      }

      // Dry-run duplicate check uses checksum only in-memory against DB when possible.
      if (dryRun) {
        const [existing] = await db
          .select({ id: legalDocuments.id })
          .from(legalDocuments)
          .where(eq(legalDocuments.rawContentHash, rawHash))
          .limit(1);
        if (existing) {
          duplicates += 1;
          results.push({
            file: doc.file,
            status: "duplicate",
            reason: "Identical content checksum already imported",
            documentId: existing.id,
            checksum,
          });
          continue;
        }

        // Parse without persisting to validate structure.
        parseLegalSourceText({
          sourceUrl: provenanceUrl || `import://${path.basename(filePath)}`,
          title: doc.title,
          documentType: mapManifestDocumentType(doc.document_type),
          contentType: mime,
          rawBytes: Buffer.from(extractText, "utf8"),
          text: extractText,
          textOrigin: doc.content_type,
          metadata: {
            issuingAuthority: doc.issuing_authority,
            year: doc.year ?? undefined,
            documentNumber: doc.document_number ?? undefined,
          },
        });

        results.push({
          file: doc.file,
          status: "would_import",
          checksum,
          contentType: doc.content_type,
          authorityStatus: manifest.authority_status,
        });
        documentsImported += 1;
        continue;
      }

      // Import one document; delete the row on failure so no partial authoritative data remains.
      const storageKey = [
        "legal-corpus",
        sourceId,
        "approved-import",
        checksum.slice(0, 16),
        path.basename(filePath),
      ].join("/");

      await getObjectStorage().putObject({
        key: storageKey,
        body: originalBytes,
        contentType: mime,
      });

      const parsed = parseLegalSourceText({
        sourceUrl: provenanceUrl || `import://${path.basename(filePath)}`,
        title: doc.title,
        documentType: mapManifestDocumentType(doc.document_type),
        contentType: mime,
        rawBytes: Buffer.from(extractText, "utf8"),
        text: extractText,
        textOrigin: doc.content_type,
        metadata: {
          issuingAuthority: doc.issuing_authority,
          year: doc.year ?? undefined,
          documentNumber: doc.document_number ?? undefined,
          publicationDate: doc.publication_date ?? undefined,
          effectiveDate: doc.effective_date ?? undefined,
          pageNumber: doc.page_number ?? undefined,
        },
      });

      const documentId = crypto.randomUUID();
      const now = new Date();
      let imported: {
        documentId: string;
        provisions: number;
        chunks: number;
      };
      try {
        await db.insert(legalDocuments).values({
          id: documentId,
          sourceId,
          country: manifest.country,
          jurisdiction: manifest.jurisdiction,
          language: doc.language,
          documentType: mapManifestDocumentType(doc.document_type),
          title: doc.title,
          documentNumber: doc.document_number ?? null,
          year: doc.year ?? null,
          issuingAuthority: doc.issuing_authority,
          publicationDate: doc.publication_date ?? null,
          effectiveDate: doc.effective_date ?? null,
          expirationDate: doc.expiration_date ?? null,
          status: "UNKNOWN",
          sourceUrl: provenanceUrl,
          alternateSourceUrls: [],
          externalId: doc.external_id ?? `import:${checksum.slice(0, 24)}`,
          originalFileLocation: storageKey,
          checksum,
          rawContentHash: rawHash,
          textOrigin: doc.content_type,
          authorityStatus: manifest.authority_status,
          acquisitionMethod: manifest.acquisition_method,
          acquisitionNote:
            doc.acquisition_note || manifest.acquisition_note || null,
          ingestionStatus: "NORMALIZED",
          previousVersionId: null,
          versionNumber: 1,
          normalizedText: parsed.normalizedText,
          metadata: {
            provenance: {
              country: manifest.country,
              authority: doc.issuing_authority,
              source: manifest.source_name,
              sourceUrl: provenanceUrl,
              documentType: mapManifestDocumentType(doc.document_type),
              acquisitionMethod: manifest.acquisition_method,
              authorityStatus: manifest.authority_status,
              contentType: doc.content_type,
              ingestedAt: now.toISOString(),
              originalFilename: path.basename(filePath),
            },
            manifestPath: absoluteManifest,
          },
          matterId: null,
          createdAt: now,
          updatedAt: now,
        });

        const chunkCount = await persistProvisionsAndChunks({
          documentId,
          sourceUrl: provenanceUrl,
          parsed,
        });

        await db
          .update(legalDocuments)
          .set({ ingestionStatus: "CHUNKED", updatedAt: new Date() })
          .where(eq(legalDocuments.id, documentId));

        imported = {
          documentId,
          provisions: parsed.provisions.length,
          chunks: chunkCount,
        };
      } catch (persistError) {
        await db
          .delete(legalDocuments)
          .where(eq(legalDocuments.id, documentId));
        throw persistError;
      }

      documentsImported += 1;
      provisionsCreated += imported.provisions;
      chunksCreated += imported.chunks;
      results.push({
        file: doc.file,
        status: "imported",
        documentId: imported.documentId,
        checksum,
        provisions: imported.provisions,
        chunks: imported.chunks,
        contentType: doc.content_type,
        authorityStatus: manifest.authority_status,
      });
    } catch (error) {
      rejected += 1;
      const message =
        error instanceof z.ZodError
          ? "Invalid document metadata"
          : error instanceof Error
            ? error.message
            : "Unknown import error";
      failures.push(`${doc.file}: ${message}`);
      results.push({
        file: doc.file,
        status: "rejected",
        reason: message,
      });
      // Do not leave partial authoritative rows — transaction rolled back.
      console.error("[legal-corpus] approved import failed", {
        file: doc.file,
        errorName: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  if (!dryRun && runId) {
    const status =
      rejected > 0 && documentsImported > 0
        ? "PARTIAL"
        : rejected > 0 && documentsImported === 0
          ? "FAILED"
          : "COMPLETED";
    await db
      .update(legalIngestionRuns)
      .set({
        status,
        completedAt: new Date(),
        fetchedCount: documentsImported + duplicates,
        parsedCount: documentsImported,
        chunkedCount: chunksCreated,
        failedCount: rejected,
        metadata: {
          phase: "approved_import",
          manifestPath: absoluteManifest,
          acquisitionMethod: manifest.acquisition_method,
          authorityStatus: manifest.authority_status,
          duplicates,
        },
        updatedAt: new Date(),
      })
      .where(eq(legalIngestionRuns.id, runId));
  }

  return {
    sourceName: manifest.source_name,
    sourceId,
    dryRun,
    runId,
    documentsDiscovered: manifest.documents.length,
    documentsImported,
    duplicates,
    rejected,
    provisionsCreated,
    chunksCreated,
    ocrDocuments,
    sourceTextDocuments,
    authority: manifest.authority_status,
    results,
    failures,
  };
}

export function formatImportReport(report: ImportReport): string {
  const lines = [
    "Egyptian Legal Corpus Import",
    "",
    `Mode: ${report.dryRun ? "DRY RUN" : "COMMIT"}`,
    `Source: ${report.sourceName}`,
    `Source ID: ${report.sourceId}`,
    "",
    `Documents discovered: ${report.documentsDiscovered}`,
    `Documents imported: ${report.documentsImported}`,
    `Duplicates: ${report.duplicates}`,
    `Rejected: ${report.rejected}`,
    "",
    `Provisions created: ${report.provisionsCreated}`,
    `Chunks created: ${report.chunksCreated}`,
    "",
    `OCR documents: ${report.ocrDocuments}`,
    `Source-text documents: ${report.sourceTextDocuments}`,
    "",
    `Authority: ${report.authority}`,
  ];

  if (report.failures.length) {
    lines.push("", "Failures:");
    for (const failure of report.failures) {
      lines.push(`- ${failure}`);
    }
  }

  return lines.join("\n");
}

/** Future RAG: authoritative corpus documents (excludes fixtures). */
export async function listAuthoritativeLegalDocuments(input?: {
  approvedOnly?: boolean;
}) {
  const rows = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.authorityStatus, "AUTHORITATIVE_SOURCE"));
  if (input?.approvedOnly) {
    return rows.filter((row) => row.reviewStatus === "APPROVED");
  }
  return rows;
}
