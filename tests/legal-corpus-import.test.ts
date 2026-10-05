import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { legalDocuments } from "@/lib/db/schema";
import { resetEnvCacheForTests } from "@/lib/env";
import {
  formatImportReport,
  importLegalManifest,
  listAuthoritativeLegalDocuments,
} from "@/modules/legal-corpus/import";
import { seedLegalSources } from "@/modules/legal-corpus/service";
import { resetObjectStorageForTests } from "@/modules/storage";

import {
  clearLegalCorpusTablesForTests,
  resetTestState,
} from "./helpers";

async function writeTempManifest(input: {
  authority_status: string;
  acquisition_method: string;
  content_type: string;
  source_url?: string | null;
  acquisition_note?: string;
  text: string;
}) {
  const tempDir = path.join(
    os.tmpdir(),
    `corpus-import-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(tempDir, { recursive: true });
  const fileName = "law.txt";
  await writeFile(path.join(tempDir, fileName), input.text, "utf8");

  const manifest = {
    source_id: "src_egypt_elp",
    source_name: "Egyptian Official Legislation",
    source_type: "OFFICIAL",
    authority_status: input.authority_status,
    acquisition_method: input.acquisition_method,
    acquisition_note: input.acquisition_note,
    country: "EG",
    jurisdiction: "Egypt",
    source_url: input.source_url,
    issuing_authority: "Arab Republic of Egypt",
    documents: [
      {
        file: `./${fileName}`,
        title: "قانون اختبار الاستيراد المعتمد",
        document_number: "77",
        year: 2024,
        document_type: "LAW",
        language: "ar",
        issuing_authority: "Arab Republic of Egypt",
        content_type: input.content_type,
        source_url: input.source_url,
        external_id: `test-import-${Date.now()}`,
      },
    ],
  };

  const manifestPath = path.join(tempDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return manifestPath;
}

const SAMPLE_TEXT = `
قانون رقم 77 لسنة 2024
المادة 1:
نص تجريبي للاستيراد المعتمد.
المادة 2:
فقرة ثانية.
`.trim();

describe("approved legal corpus import", () => {
  beforeEach(async () => {
    resetTestState();
    resetObjectStorageForTests();
    process.env.LEGAL_CORPUS_MODE = "fixture";
    resetEnvCacheForTests();
    await clearLegalCorpusTablesForTests();
    await seedLegalSources();
  });

  it("imports an authorized manifest into LegalDocument/Provisions/Chunks", async () => {
    const manifestPath = await writeTempManifest({
      authority_status: "AUTHORITATIVE_SOURCE",
      acquisition_method: "AUTHORIZED_MANUAL_IMPORT",
      content_type: "SOURCE_TEXT",
      source_url: "https://elpai.idsc.gov.eg/",
      acquisition_note: "Legitimately obtained test import",
      text: SAMPLE_TEXT,
    });

    const report = await importLegalManifest({ manifestPath });
    expect(report.documentsImported).toBe(1);
    expect(report.rejected).toBe(0);
    expect(report.authority).toBe("AUTHORITATIVE_SOURCE");
    expect(report.provisionsCreated).toBeGreaterThanOrEqual(1);
    expect(report.chunksCreated).toBeGreaterThanOrEqual(1);

    const docs = await listAuthoritativeLegalDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.matterId).toBeNull();
    expect(docs[0]?.textOrigin).toBe("SOURCE_TEXT");
    expect(docs[0]?.acquisitionMethod).toBe("AUTHORIZED_MANUAL_IMPORT");
    expect(docs[0]?.originalFileLocation).toBeTruthy();
    expect(docs[0]?.normalizedText).toContain("المادة");
  });

  it("dry-run validates without writing authoritative documents", async () => {
    const manifestPath = await writeTempManifest({
      authority_status: "AUTHORITATIVE_SOURCE",
      acquisition_method: "AUTHORIZED_MANUAL_IMPORT",
      content_type: "SOURCE_TEXT",
      source_url: "https://elpai.idsc.gov.eg/",
      text: SAMPLE_TEXT,
    });

    const report = await importLegalManifest({
      manifestPath,
      dryRun: true,
    });
    expect(report.dryRun).toBe(true);
    expect(report.documentsImported).toBe(1);
    expect(report.results[0]?.status).toBe("would_import");
    expect(await db.select().from(legalDocuments)).toHaveLength(0);

    const printed = formatImportReport(report);
    expect(printed).toContain("DRY RUN");
    expect(printed).toContain("AUTHORITATIVE_SOURCE");
  });

  it("deduplicates identical imports by checksum", async () => {
    const manifestPath = await writeTempManifest({
      authority_status: "AUTHORITATIVE_SOURCE",
      acquisition_method: "OFFICIAL_DOWNLOAD",
      content_type: "SOURCE_TEXT",
      source_url: "https://elpai.idsc.gov.eg/",
      text: SAMPLE_TEXT,
    });

    const first = await importLegalManifest({ manifestPath });
    expect(first.documentsImported).toBe(1);

    // Second import with same file bytes
    const second = await importLegalManifest({ manifestPath });
    expect(second.duplicates).toBe(1);
    expect(second.documentsImported).toBe(0);
    expect(await db.select().from(legalDocuments)).toHaveLength(1);
  });

  it("rejects FIXTURE content promoted to AUTHORITATIVE_SOURCE", async () => {
    const manifestPath = await writeTempManifest({
      authority_status: "AUTHORITATIVE_SOURCE",
      acquisition_method: "AUTHORIZED_MANUAL_IMPORT",
      content_type: "FIXTURE",
      source_url: "https://elpai.idsc.gov.eg/",
      text: SAMPLE_TEXT,
    });

    await expect(importLegalManifest({ manifestPath })).rejects.toThrow(
      /FIXTURE/i,
    );
    expect(await db.select().from(legalDocuments)).toHaveLength(0);
  });

  it("rejects authoritative import without provenance", async () => {
    const manifestPath = await writeTempManifest({
      authority_status: "AUTHORITATIVE_SOURCE",
      acquisition_method: "AUTHORIZED_MANUAL_IMPORT",
      content_type: "SOURCE_TEXT",
      source_url: null,
      text: SAMPLE_TEXT,
    });

    await expect(importLegalManifest({ manifestPath })).rejects.toThrow(
      /source_url or acquisition_note/i,
    );
  });

  it("allows authoritative OCR with content_type OCR", async () => {
    const manifestPath = await writeTempManifest({
      authority_status: "AUTHORITATIVE_SOURCE",
      acquisition_method: "AUTHORIZED_MANUAL_IMPORT",
      content_type: "OCR",
      source_url: "https://www.cc.gov.eg/",
      acquisition_note: "OCR of a page image from an authorized heritage scan",
      text: SAMPLE_TEXT,
    });

    const report = await importLegalManifest({ manifestPath });
    expect(report.documentsImported).toBe(1);
    expect(report.ocrDocuments).toBe(1);

    const [doc] = await db.select().from(legalDocuments);
    expect(doc?.authorityStatus).toBe("AUTHORITATIVE_SOURCE");
    expect(doc?.textOrigin).toBe("OCR");
  });

  it("requires DERIVED authority for DERIVED_TRANSLATION content", async () => {
    const manifestPath = await writeTempManifest({
      authority_status: "AUTHORITATIVE_SOURCE",
      acquisition_method: "AUTHORIZED_MANUAL_IMPORT",
      content_type: "DERIVED_TRANSLATION",
      source_url: "https://elpai.idsc.gov.eg/",
      text: "Article 1: English translation sample",
    });

    await expect(importLegalManifest({ manifestPath })).rejects.toThrow(
      /DERIVED_TRANSLATION/i,
    );
  });

  it("keeps fixture adapter docs from contaminating authoritative queries", async () => {
    // Seed fixture via existing pipeline-style insert simulation:
    await db.insert(legalDocuments).values({
      id: crypto.randomUUID(),
      sourceId: "src_egypt_elp",
      country: "EG",
      jurisdiction: "Egypt",
      language: "ar",
      documentType: "LEGISLATION",
      title: "Fixture law",
      issuingAuthority: "Fixture",
      status: "UNKNOWN",
      sourceUrl: "https://example.test/fixture",
      checksum: "fixture-checksum",
      rawContentHash: "fixture-raw",
      textOrigin: "FIXTURE",
      authorityStatus: "FIXTURE",
      acquisitionMethod: "FIXTURE",
      ingestionStatus: "CHUNKED",
      versionNumber: 1,
      matterId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const authoritative = await listAuthoritativeLegalDocuments();
    expect(authoritative).toHaveLength(0);

    const fixtures = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.authorityStatus, "FIXTURE"));
    expect(fixtures).toHaveLength(1);
  });
});
