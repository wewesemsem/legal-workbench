import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  legalChunks,
  legalDiscoveredDocuments,
  legalDocuments,
  legalIngestionRuns,
  legalProvisions,
  legalSources,
} from "@/lib/db/schema";
import {
  EGYPT_SOURCE_SEEDS,
  getAdapter,
  resolveSourceIdAlias,
} from "@/modules/legal-corpus/adapters";
import { formatConstitutionValidationReport } from "@/modules/legal-corpus/constitution";
import { sha256Hex } from "@/modules/legal-corpus/checksum";
import {
  runDiscoveryForSource,
  runIngestionForSource,
} from "@/modules/legal-corpus/pipeline";
import { chunkProvisions } from "@/modules/legal-corpus/chunk";
import { collectProvisions } from "@/modules/legal-corpus/hierarchy";

export async function seedLegalSources() {
  const now = new Date();
  for (const seed of EGYPT_SOURCE_SEEDS) {
    const existing = await db
      .select({ id: legalSources.id })
      .from(legalSources)
      .where(eq(legalSources.id, seed.id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(legalSources)
        .set({
          name: seed.name,
          authority: seed.authority,
          country: seed.country,
          jurisdiction: seed.jurisdiction,
          baseUrl: seed.baseUrl,
          sourceType: seed.sourceType,
          accessStatus: seed.accessStatus,
          authorityStatus: seed.authorityStatus,
          acquisitionMethod: seed.acquisitionMethod,
          approvedForAutomatedAcquisition: seed.approvedForAutomatedAcquisition,
          adapterKey: seed.adapterKey,
          notes: seed.notes,
          updatedAt: now,
        })
        .where(eq(legalSources.id, seed.id));
    } else {
      await db.insert(legalSources).values({
        id: seed.id,
        name: seed.name,
        authority: seed.authority,
        country: seed.country,
        jurisdiction: seed.jurisdiction,
        baseUrl: seed.baseUrl,
        sourceType: seed.sourceType,
        accessStatus: seed.accessStatus,
        authorityStatus: seed.authorityStatus,
        acquisitionMethod: seed.acquisitionMethod,
        approvedForAutomatedAcquisition: seed.approvedForAutomatedAcquisition,
        ingestionEnabled: true,
        adapterKey: seed.adapterKey,
        notes: seed.notes,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return listLegalSources();
}

export async function listLegalSources() {
  return db.select().from(legalSources).orderBy(asc(legalSources.name));
}

export async function setSourceEnabled(input: {
  sourceId: string;
  enabled: boolean;
}) {
  if (!input.enabled) {
    await db
      .update(legalSources)
      .set({
        ingestionEnabled: false,
        accessStatus: "DISABLED",
        updatedAt: new Date(),
      })
      .where(eq(legalSources.id, input.sourceId));
  } else {
    await db
      .update(legalSources)
      .set({
        ingestionEnabled: true,
        accessStatus: "UNKNOWN",
        updatedAt: new Date(),
      })
      .where(eq(legalSources.id, input.sourceId));
  }

  const [source] = await db
    .select()
    .from(legalSources)
    .where(eq(legalSources.id, input.sourceId))
    .limit(1);
  return source;
}

export async function discoverSource(sourceId: string, limit?: number) {
  return runDiscoveryForSource({ sourceId, limit });
}

export async function ingestSource(sourceId: string, limit?: number) {
  return runIngestionForSource({ sourceId, limit });
}

export async function discoverAndIngestAll(limitPerSource = 10) {
  const sources = await listLegalSources();
  const results = [];
  for (const source of sources) {
    if (!source.ingestionEnabled) {
      results.push({
        sourceId: source.id,
        skipped: true,
        reason: "disabled",
      });
      continue;
    }
    const discovered = await discoverSource(source.id, limitPerSource);
    const ingested = await ingestSource(source.id, limitPerSource);
    results.push({
      sourceId: source.id,
      skipped: false,
      discovered,
      ingested,
    });
  }
  return results;
}

export async function listIngestionRuns(limit = 20) {
  return db
    .select()
    .from(legalIngestionRuns)
    .orderBy(desc(legalIngestionRuns.startedAt))
    .limit(limit);
}

export async function listFailedDiscoveries(limit = 50) {
  return db
    .select()
    .from(legalDiscoveredDocuments)
    .where(eq(legalDiscoveredDocuments.ingestionStatus, "FAILED"))
    .limit(limit);
}

export async function getCorpusStats() {
  const [sources] = await db.select({ value: count() }).from(legalSources);
  const [documents] = await db.select({ value: count() }).from(legalDocuments);
  const [provisions] = await db.select({ value: count() }).from(legalProvisions);
  const [chunks] = await db.select({ value: count() }).from(legalChunks);
  const [failed] = await db
    .select({ value: count() })
    .from(legalDiscoveredDocuments)
    .where(eq(legalDiscoveredDocuments.ingestionStatus, "FAILED"));
  const [restricted] = await db
    .select({ value: count() })
    .from(legalDiscoveredDocuments)
    .where(eq(legalDiscoveredDocuments.ingestionStatus, "ACCESS_RESTRICTED"));
  const [matterLinked] = await db
    .select({ value: count() })
    .from(legalDocuments)
    .where(sql`${legalDocuments.matterId} is not null`);
  const [authoritative] = await db
    .select({ value: count() })
    .from(legalDocuments)
    .where(eq(legalDocuments.authorityStatus, "AUTHORITATIVE_SOURCE"));
  const [fixtures] = await db
    .select({ value: count() })
    .from(legalDocuments)
    .where(eq(legalDocuments.authorityStatus, "FIXTURE"));
  const [approvedAuthoritative] = await db
    .select({ value: count() })
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.authorityStatus, "AUTHORITATIVE_SOURCE"),
        eq(legalDocuments.reviewStatus, "APPROVED"),
      ),
    );

  return {
    sources: Number(sources?.value ?? 0),
    documents: Number(documents?.value ?? 0),
    provisions: Number(provisions?.value ?? 0),
    chunks: Number(chunks?.value ?? 0),
    failed: Number(failed?.value ?? 0),
    restricted: Number(restricted?.value ?? 0),
    matterLinkedDocuments: Number(matterLinked?.value ?? 0),
    authoritativeDocuments: Number(authoritative?.value ?? 0),
    approvedAuthoritativeDocuments: Number(approvedAuthoritative?.value ?? 0),
    fixtureDocuments: Number(fixtures?.value ?? 0),
  };
}

export async function assertCorpusMatterIsolation() {
  const linked = await db
    .select({ id: legalDocuments.id })
    .from(legalDocuments)
    .where(sql`${legalDocuments.matterId} is not null`)
    .limit(1);
  return linked.length === 0;
}

export async function getDocumentsWithoutProvenance() {
  // Provenance requires source + sourceUrl + authority via join + documentType.
  return db
    .select({
      id: legalDocuments.id,
      sourceId: legalDocuments.sourceId,
      sourceUrl: legalDocuments.sourceUrl,
      documentType: legalDocuments.documentType,
      issuingAuthority: legalDocuments.issuingAuthority,
      country: legalDocuments.country,
    })
    .from(legalDocuments)
    .where(isNull(legalDocuments.sourceUrl));
}

export async function dryRunOfficialIngest(sourceIdOrAlias: string) {
  const sourceId = resolveSourceIdAlias(sourceIdOrAlias);
  await seedLegalSources();
  const [source] = await db
    .select()
    .from(legalSources)
    .where(eq(legalSources.id, sourceId))
    .limit(1);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const adapter = getAdapter(source.adapterKey);
  const discovered = await adapter.discover({ limit: 10 });
  const results = [];
  for (const item of discovered) {
    const fetched = await adapter.fetch(item);
    if (fetched.accessRestricted) {
      results.push({
        sourceUrl: item.sourceUrl,
        status: "ACCESS_RESTRICTED",
        reason: fetched.errorMessage,
      });
      continue;
    }
    const parsed = await adapter.parse(fetched);
    const articleCount = collectProvisions(parsed.provisions).filter(
      (provision) => provision.provisionType === "ARTICLE",
    ).length;
    const chunkCount = chunkProvisions(parsed.provisions, {
      documentType: parsed.documentType,
    }).length;
    results.push({
      sourceUrl: fetched.sourceUrl,
      status: "would_import",
      title: parsed.title,
      documentType: parsed.documentType,
      authorityStatus: parsed.authorityStatus ?? fetched.authorityStatus,
      textOrigin: parsed.textOrigin,
      checksum: sha256Hex(fetched.rawBytes),
      provisions: parsed.provisions.length,
      articles: articleCount,
      chunks: chunkCount,
    });
  }

  return {
    dryRun: true,
    sourceId: source.id,
    sourceName: source.name,
    discovered: discovered.length,
    results,
  };
}

export async function validateLegalDocument(documentId: string) {
  const [doc] = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.id, documentId))
    .limit(1);
  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }
  const [source] = await db
    .select()
    .from(legalSources)
    .where(eq(legalSources.id, doc.sourceId))
    .limit(1);
  const provisions = await db
    .select()
    .from(legalProvisions)
    .where(eq(legalProvisions.legalDocumentId, documentId));
  const chunks = await db
    .select()
    .from(legalChunks)
    .where(eq(legalChunks.legalDocumentId, documentId));
  const articles = provisions.filter(
    (provision) => provision.provisionType === "ARTICLE",
  );
  const errors: string[] = [];
  if (!doc.title.trim()) errors.push("missing title");
  if (doc.language !== "ar") errors.push(`unexpected language ${doc.language}`);
  if (!doc.sourceUrl) errors.push("missing source_url");
  if (!doc.issuingAuthority) errors.push("missing issuing_authority");
  if (!doc.checksum || !doc.rawContentHash) errors.push("missing checksum");
  if (!doc.normalizedText?.trim()) errors.push("empty normalized text");
  if (doc.documentType === "CONSTITUTION" && articles.length < 2) {
    errors.push("constitution has fewer than 2 articles");
  }
  if (
    doc.authorityStatus === "AUTHORITATIVE_SOURCE" &&
    doc.textOrigin === "FIXTURE"
  ) {
    errors.push("fixture text cannot be authoritative");
  }

  const status = errors.length === 0 ? "SUCCESS" : "FAILED";
  const report = formatConstitutionValidationReport({
    sourceName: source?.name ?? doc.sourceId,
    sourceUrl: doc.sourceUrl ?? "",
    authority: doc.issuingAuthority,
    language: doc.language,
    documents: 1,
    articles: articles.length,
    chunks: chunks.length,
    authorityStatus: doc.authorityStatus,
    contentType: doc.textOrigin,
    status,
    note: errors.length ? errors.join("; ") : undefined,
  });

  return {
    documentId: doc.id,
    status,
    errors,
    reviewStatus: doc.reviewStatus,
    authorityStatus: doc.authorityStatus,
    textOrigin: doc.textOrigin,
    articles: articles.length,
    chunks: chunks.length,
    report,
  };
}

export async function approveLegalDocument(input: {
  documentId: string;
  note?: string;
}) {
  const validation = await validateLegalDocument(input.documentId);
  if (validation.status !== "SUCCESS") {
    throw new Error(
      `Cannot approve document failing validation: ${validation.errors.join("; ")}`,
    );
  }
  const [doc] = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.id, input.documentId))
    .limit(1);
  if (!doc) {
    throw new Error(`Document not found: ${input.documentId}`);
  }
  if (doc.authorityStatus !== "AUTHORITATIVE_SOURCE") {
    throw new Error("Only AUTHORITATIVE_SOURCE documents can be approved for RAG");
  }

  await db
    .update(legalDocuments)
    .set({
      reviewStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewNote: input.note ?? "Approved for production RAG eligibility",
      updatedAt: new Date(),
    })
    .where(eq(legalDocuments.id, input.documentId));

  const [updated] = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.id, input.documentId))
    .limit(1);
  return updated;
}

export async function getAuthoritativeApprovedDocuments() {
  return db
    .select()
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.authorityStatus, "AUTHORITATIVE_SOURCE"),
        eq(legalDocuments.reviewStatus, "APPROVED"),
      ),
    );
}

export { resolveSourceIdAlias };
