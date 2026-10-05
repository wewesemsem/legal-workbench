import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  legalDiscoveredDocuments,
  legalDocuments,
  legalIngestionRuns,
  legalSources,
} from "@/lib/db/schema";
import { getObjectStorage } from "@/modules/storage";
import { getAdapter } from "@/modules/legal-corpus/adapters";
import { canonicalizeUrl, sha256Hex } from "@/modules/legal-corpus/checksum";
import { persistProvisionsAndChunks } from "@/modules/legal-corpus/persist";
import type {
  DiscoveredDocument,
  FetchedDocument,
  ParsedLegalDocument,
} from "@/modules/legal-corpus/types";

function logCorpus(
  action: string,
  meta: Record<string, string | number | boolean | null | undefined>,
) {
  // Never log legal document contents.
  console.info("[legal-corpus]", action, meta);
}

function resolveAuthorityStatus(
  parsed: ParsedLegalDocument,
  fetched: FetchedDocument,
) {
  if (parsed.textOrigin === "FIXTURE" || fetched.textOrigin === "FIXTURE") {
    return "FIXTURE" as const;
  }
  return (
    parsed.authorityStatus ??
    fetched.authorityStatus ??
    ("UNVERIFIED" as const)
  );
}

function resolveAcquisitionMethod(
  parsed: ParsedLegalDocument,
  fetched: FetchedDocument,
) {
  if (parsed.textOrigin === "FIXTURE" || fetched.textOrigin === "FIXTURE") {
    return "FIXTURE" as const;
  }
  return (
    parsed.acquisitionMethod ??
    fetched.acquisitionMethod ??
    ("FUTURE_CONNECTOR" as const)
  );
}

function resolveAcquisitionNote(
  parsed: ParsedLegalDocument,
  fetched: FetchedDocument,
) {
  if (parsed.textOrigin === "FIXTURE" || fetched.textOrigin === "FIXTURE") {
    return "Pipeline fixture sample — not authoritative Egyptian law";
  }
  return parsed.acquisitionNote ?? fetched.acquisitionNote ?? null;
}

function resolveReviewStatus(
  parsed: ParsedLegalDocument,
  fetched: FetchedDocument,
) {
  if (parsed.textOrigin === "FIXTURE" || fetched.textOrigin === "FIXTURE") {
    return "REJECTED" as const;
  }
  return (
    parsed.reviewStatus ?? fetched.reviewStatus ?? ("PENDING_REVIEW" as const)
  );
}

export async function runDiscoveryForSource(input: {
  sourceId: string;
  limit?: number;
}) {
  const [source] = await db
    .select()
    .from(legalSources)
    .where(eq(legalSources.id, input.sourceId))
    .limit(1);

  if (!source) {
    throw new Error(`Source not found: ${input.sourceId}`);
  }
  if (!source.ingestionEnabled) {
    throw new Error(`Source is disabled: ${source.name}`);
  }

  const runId = crypto.randomUUID();
  const now = new Date();
  await db.insert(legalIngestionRuns).values({
    id: runId,
    sourceId: source.id,
    status: "RUNNING",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    metadata: { phase: "discover" },
  });

  const adapter = getAdapter(source.adapterKey);
  let discovered: DiscoveredDocument[] = [];
  try {
    discovered = await adapter.discover({ limit: input.limit });
  } catch (error) {
    await db
      .update(legalIngestionRuns)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        failedCount: 1,
        updatedAt: new Date(),
        metadata: {
          phase: "discover",
          error: error instanceof Error ? error.message : "unknown",
        },
      })
      .where(eq(legalIngestionRuns.id, runId));
    throw error;
  }

  let discoveredCount = 0;
  for (const item of discovered) {
    if (!item.sourceUrl || !item.documentType) {
      continue;
    }
    const sourceUrl = canonicalizeUrl(item.sourceUrl);
    const existing = await db
      .select({ id: legalDiscoveredDocuments.id })
      .from(legalDiscoveredDocuments)
      .where(
        and(
          eq(legalDiscoveredDocuments.sourceId, source.id),
          eq(legalDiscoveredDocuments.sourceUrl, sourceUrl),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(legalDiscoveredDocuments)
        .set({
          title: item.title ?? null,
          documentType: item.documentType,
          externalId: item.externalId ?? null,
          metadata: item.metadata ?? {},
          ingestionRunId: runId,
          updatedAt: new Date(),
        })
        .where(eq(legalDiscoveredDocuments.id, existing[0].id));
    } else {
      await db.insert(legalDiscoveredDocuments).values({
        id: crypto.randomUUID(),
        sourceId: source.id,
        ingestionRunId: runId,
        sourceUrl,
        title: item.title ?? null,
        documentType: item.documentType,
        externalId: item.externalId ?? null,
        metadata: item.metadata ?? {},
        ingestionStatus: "DISCOVERED",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    discoveredCount += 1;
  }

  await db
    .update(legalSources)
    .set({ lastCheckedAt: new Date(), updatedAt: new Date() })
    .where(eq(legalSources.id, source.id));

  await db
    .update(legalIngestionRuns)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      discoveredCount,
      updatedAt: new Date(),
    })
    .where(eq(legalIngestionRuns.id, runId));

  logCorpus("discover.completed", {
    sourceId: source.id,
    runId,
    discoveredCount,
  });

  return { runId, discoveredCount };
}

export async function runIngestionForSource(input: {
  sourceId: string;
  limit?: number;
}) {
  const [source] = await db
    .select()
    .from(legalSources)
    .where(eq(legalSources.id, input.sourceId))
    .limit(1);

  if (!source) {
    throw new Error(`Source not found: ${input.sourceId}`);
  }
  if (!source.ingestionEnabled) {
    throw new Error(`Source is disabled: ${source.name}`);
  }

  const runId = crypto.randomUUID();
  const now = new Date();
  await db.insert(legalIngestionRuns).values({
    id: runId,
    sourceId: source.id,
    status: "RUNNING",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    metadata: { phase: "ingest" },
  });

  const pending = await db
    .select()
    .from(legalDiscoveredDocuments)
    .where(eq(legalDiscoveredDocuments.sourceId, source.id));

  const queue = pending
    .filter(
      (row) =>
        row.ingestionStatus === "DISCOVERED" ||
        row.ingestionStatus === "FAILED",
    )
    .slice(0, input.limit ?? 50);

  const adapter = getAdapter(source.adapterKey);
  let fetchedCount = 0;
  let parsedCount = 0;
  let chunkedCount = 0;
  let failedCount = 0;
  let restrictedCount = 0;

  for (const discovered of queue) {
    const started = Date.now();
    try {
      const fetched = await adapter.fetch({
        sourceUrl: discovered.sourceUrl,
        title: discovered.title ?? undefined,
        documentType: discovered.documentType,
        externalId: discovered.externalId ?? undefined,
        metadata: (discovered.metadata ?? {}) as Record<string, unknown>,
      });

      if (fetched.accessRestricted) {
        restrictedCount += 1;
        await db
          .update(legalDiscoveredDocuments)
          .set({
            ingestionStatus: "ACCESS_RESTRICTED",
            errorCategory: "ACCESS_RESTRICTED",
            errorMessage: fetched.errorMessage ?? "ACCESS_RESTRICTED",
            ingestionRunId: runId,
            updatedAt: new Date(),
          })
          .where(eq(legalDiscoveredDocuments.id, discovered.id));

        await db
          .update(legalSources)
          .set({
            accessStatus: "ACCESS_RESTRICTED",
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(legalSources.id, source.id));

        logCorpus("ingest.restricted", {
          sourceId: source.id,
          discoveredId: discovered.id,
          durationMs: Date.now() - started,
        });
        continue;
      }

      fetchedCount += 1;
      const rawHash = sha256Hex(fetched.rawBytes);
      const checksum = sha256Hex(
        `${canonicalizeUrl(fetched.sourceUrl)}:${rawHash}`,
      );

      const storageKey = [
        "legal-corpus",
        source.id,
        discovered.externalId || discovered.id,
        "raw",
        `${checksum.slice(0, 16)}.bin`,
      ].join("/");

      await getObjectStorage().putObject({
        key: storageKey,
        body: fetched.rawBytes,
        contentType: fetched.contentType,
      });

      await db
        .update(legalDiscoveredDocuments)
        .set({
          ingestionStatus: "FETCHED",
          ingestionRunId: runId,
          updatedAt: new Date(),
        })
        .where(eq(legalDiscoveredDocuments.id, discovered.id));

      // Dedup by external ID / URL / checksum
      const [byExternal] =
        fetched.externalId
          ? await db
              .select()
              .from(legalDocuments)
              .where(
                and(
                  eq(legalDocuments.sourceId, source.id),
                  eq(legalDocuments.externalId, fetched.externalId),
                ),
              )
              .limit(1)
          : [];

      const [byUrl] = await db
        .select()
        .from(legalDocuments)
        .where(
          and(
            eq(legalDocuments.sourceId, source.id),
            eq(legalDocuments.sourceUrl, canonicalizeUrl(fetched.sourceUrl)),
          ),
        )
        .limit(1);

      const [byChecksum] = await db
        .select()
        .from(legalDocuments)
        .where(
          and(
            eq(legalDocuments.sourceId, source.id),
            eq(legalDocuments.rawContentHash, rawHash),
          ),
        )
        .limit(1);

      const existing = byExternal || byUrl || byChecksum;
      if (existing && existing.rawContentHash === rawHash) {
        await db
          .update(legalDiscoveredDocuments)
          .set({
            ingestionStatus: "SKIPPED",
            errorCategory: "DUPLICATE",
            errorMessage: "Duplicate content checksum",
            updatedAt: new Date(),
          })
          .where(eq(legalDiscoveredDocuments.id, discovered.id));
        logCorpus("ingest.duplicate", {
          sourceId: source.id,
          documentId: existing.id,
        });
        continue;
      }

      const parsed = await adapter.parse(fetched);
      parsedCount += 1;

      let documentId = existing?.id;
      if (existing && existing.rawContentHash !== rawHash) {
        // Versioning: supersede prior version; do not destroy it.
        await db
          .update(legalDocuments)
          .set({
            status: "SUPERSEDED",
            updatedAt: new Date(),
          })
          .where(eq(legalDocuments.id, existing.id));

        documentId = crypto.randomUUID();
        await db.insert(legalDocuments).values({
          id: documentId,
          sourceId: source.id,
          country: source.country,
          jurisdiction: source.jurisdiction,
          language: parsed.language,
          documentType: parsed.documentType,
          title: parsed.title,
          documentNumber: parsed.documentNumber ?? null,
          year: parsed.year ?? null,
          issuingAuthority: parsed.issuingAuthority,
          publicationDate: parsed.publicationDate ?? null,
          effectiveDate: parsed.effectiveDate ?? null,
          expirationDate: parsed.expirationDate ?? null,
          status: "UNKNOWN",
          sourceUrl: canonicalizeUrl(fetched.sourceUrl),
          alternateSourceUrls: [],
          externalId: fetched.externalId ?? discovered.externalId,
          originalFileLocation: storageKey,
          checksum,
          rawContentHash: rawHash,
          textOrigin: parsed.textOrigin,
          authorityStatus: resolveAuthorityStatus(parsed, fetched),
          acquisitionMethod: resolveAcquisitionMethod(parsed, fetched),
          acquisitionNote: resolveAcquisitionNote(parsed, fetched),
          reviewStatus: resolveReviewStatus(parsed, fetched),
          ingestionStatus: "NORMALIZED",
          previousVersionId: existing.id,
          versionNumber: (existing.versionNumber ?? 1) + 1,
          normalizedText: parsed.normalizedText,
          metadata: {
            ...(parsed.metadata ?? {}),
            provenance: {
              country: source.country,
              jurisdiction: source.jurisdiction,
              authority: source.authority,
              source: source.name,
              sourceUrl: fetched.sourceUrl,
              documentType: parsed.documentType,
              acquisitionMethod: resolveAcquisitionMethod(parsed, fetched),
              authorityStatus: resolveAuthorityStatus(parsed, fetched),
              retrievedAt:
                (fetched.metadata?.retrieved_at as string | undefined) ??
                new Date().toISOString(),
              ingestedAt: new Date().toISOString(),
            },
          },
          matterId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else if (!existing) {
        documentId = crypto.randomUUID();
        await db.insert(legalDocuments).values({
          id: documentId,
          sourceId: source.id,
          country: source.country,
          jurisdiction: source.jurisdiction,
          language: parsed.language,
          documentType: parsed.documentType,
          title: parsed.title,
          documentNumber: parsed.documentNumber ?? null,
          year: parsed.year ?? null,
          issuingAuthority: parsed.issuingAuthority,
          publicationDate: parsed.publicationDate ?? null,
          effectiveDate: parsed.effectiveDate ?? null,
          expirationDate: parsed.expirationDate ?? null,
          status: "UNKNOWN",
          sourceUrl: canonicalizeUrl(fetched.sourceUrl),
          alternateSourceUrls: [],
          externalId: fetched.externalId ?? discovered.externalId,
          originalFileLocation: storageKey,
          checksum,
          rawContentHash: rawHash,
          textOrigin: parsed.textOrigin,
          authorityStatus: resolveAuthorityStatus(parsed, fetched),
          acquisitionMethod: resolveAcquisitionMethod(parsed, fetched),
          acquisitionNote: resolveAcquisitionNote(parsed, fetched),
          reviewStatus: resolveReviewStatus(parsed, fetched),
          ingestionStatus: "NORMALIZED",
          previousVersionId: null,
          versionNumber: 1,
          normalizedText: parsed.normalizedText,
          metadata: {
            ...(parsed.metadata ?? {}),
            provenance: {
              country: source.country,
              jurisdiction: source.jurisdiction,
              authority: source.authority,
              source: source.name,
              sourceUrl: fetched.sourceUrl,
              documentType: parsed.documentType,
              acquisitionMethod: resolveAcquisitionMethod(parsed, fetched),
              authorityStatus: resolveAuthorityStatus(parsed, fetched),
              retrievedAt:
                (fetched.metadata?.retrieved_at as string | undefined) ??
                new Date().toISOString(),
              ingestedAt: new Date().toISOString(),
            },
          },
          matterId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (!documentId) {
        throw new Error("Failed to resolve legal document id");
      }

      const chunkCount = await persistProvisionsAndChunks({
        documentId,
        sourceUrl: canonicalizeUrl(fetched.sourceUrl),
        parsed,
      });
      chunkedCount += chunkCount;

      await db
        .update(legalDocuments)
        .set({
          ingestionStatus: "CHUNKED",
          updatedAt: new Date(),
        })
        .where(eq(legalDocuments.id, documentId));

      await db
        .update(legalDiscoveredDocuments)
        .set({
          ingestionStatus: "CHUNKED",
          errorCategory: null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(legalDiscoveredDocuments.id, discovered.id));

      if (resolveAuthorityStatus(parsed, fetched) === "AUTHORITATIVE_SOURCE") {
        await db
          .update(legalSources)
          .set({
            accessStatus: "PUBLIC",
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(legalSources.id, source.id));
      }

      logCorpus("ingest.document", {
        sourceId: source.id,
        documentId,
        status: "CHUNKED",
        durationMs: Date.now() - started,
        checksum: checksum.slice(0, 12),
      });
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : "unknown";
      const category =
        /ACCESS_RESTRICTED/i.test(message)
          ? "ACCESS_RESTRICTED"
          : /timeout|network|fetch/i.test(message)
            ? "NETWORK_ERROR"
            : /parse|invalid/i.test(message)
              ? "PARSE_ERROR"
              : "UNKNOWN";

      if (category === "ACCESS_RESTRICTED") {
        restrictedCount += 1;
      }

      await db
        .update(legalDiscoveredDocuments)
        .set({
          ingestionStatus:
            category === "ACCESS_RESTRICTED" ? "ACCESS_RESTRICTED" : "FAILED",
          errorCategory: category,
          errorMessage: message.slice(0, 500),
          ingestionRunId: runId,
          updatedAt: new Date(),
        })
        .where(eq(legalDiscoveredDocuments.id, discovered.id));

      logCorpus("ingest.failed", {
        sourceId: source.id,
        discoveredId: discovered.id,
        errorCategory: category,
        durationMs: Date.now() - started,
      });
    }
  }

  const status =
    failedCount > 0 && parsedCount > 0
      ? "PARTIAL"
      : failedCount > 0 && parsedCount === 0 && restrictedCount === 0
        ? "FAILED"
        : "COMPLETED";

  await db
    .update(legalIngestionRuns)
    .set({
      status,
      completedAt: new Date(),
      fetchedCount,
      parsedCount,
      chunkedCount,
      failedCount,
      restrictedCount,
      updatedAt: new Date(),
    })
    .where(eq(legalIngestionRuns.id, runId));

  return {
    runId,
    fetchedCount,
    parsedCount,
    chunkedCount,
    failedCount,
    restrictedCount,
    status,
  };
}
