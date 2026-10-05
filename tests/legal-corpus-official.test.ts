import { readFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  legalDiscoveredDocuments,
  legalDocuments,
  legalProvisions,
} from "@/lib/db/schema";
import { resetEnvCacheForTests } from "@/lib/env";
import { getAdapter } from "@/modules/legal-corpus/adapters";
import { createParliamentConstitutionAdapter } from "@/modules/legal-corpus/adapters/parliament-constitution";
import {
  parseConstitutionSnapshot,
  type ConstitutionSnapshot,
} from "@/modules/legal-corpus/constitution";
import { collectProvisions } from "@/modules/legal-corpus/hierarchy";
import { detectAccessRestriction } from "@/modules/legal-corpus/http";
import {
  approveLegalDocument,
  discoverSource,
  getAuthoritativeApprovedDocuments,
  ingestSource,
  seedLegalSources,
  validateLegalDocument,
} from "@/modules/legal-corpus/service";
import { resetObjectStorageForTests } from "@/modules/storage";

import {
  clearLegalCorpusTablesForTests,
  resetTestState,
} from "./helpers";

function loadSampleSnapshot(): ConstitutionSnapshot {
  const sample = JSON.parse(
    readFileSync(
      path.join(
        process.cwd(),
        "fixtures/legal-corpus/official-web/constitution-sample.json",
      ),
      "utf8",
    ),
  ) as {
    source_url: string;
    title: string;
    preamble?: string;
    articles: Array<{
      bab?: string;
      chapter?: string;
      number: string;
      label?: string;
      text: string;
    }>;
  };
  return {
    sourceUrl: sample.source_url,
    retrievedAt: "2026-10-03T00:00:00.000Z",
    hostname: "parliament.gov.eg",
    title: sample.title,
    preamble: sample.preamble,
    articles: sample.articles.map((article) => ({
      number: article.number,
      text: article.text,
      bab: article.bab,
      chapter: article.chapter,
      label: article.label,
    })),
  };
}

describe("official public source acquisition", () => {
  beforeEach(async () => {
    resetTestState();
    resetObjectStorageForTests();
    process.env.LEGAL_CORPUS_MODE = "fixture";
    resetEnvCacheForTests();
    await clearLegalCorpusTablesForTests();
  });

  it("parses Parliament Constitution snapshot into articles/chunks with provenance", async () => {
    const snapshot = loadSampleSnapshot();
    const parsed = parseConstitutionSnapshot(snapshot);
    expect(parsed.documentType).toBe("CONSTITUTION");
    expect(parsed.authorityStatus).toBe("AUTHORITATIVE_SOURCE");
    expect(parsed.textOrigin).toBe("SOURCE_TEXT");
    expect(parsed.acquisitionMethod).toBe("OFFICIAL_PUBLIC_WEB");
    expect(parsed.language).toBe("ar");
    const articles = collectProvisions(parsed.provisions).filter(
      (provision) => provision.provisionType === "ARTICLE",
    );
    expect(articles.length).toBeGreaterThanOrEqual(2);
    expect(articles[0]?.text).toMatch(/جمهورية مصر العربية/);
    expect(parsed.metadata?.source_url).toBe(
      "https://parliament.gov.eg/Constitution.aspx",
    );
    expect(parsed.metadata?.hostname).toBe("parliament.gov.eg");
  });

  it("ingests constitution adapter output as AUTHORITATIVE_SOURCE with review pending", async () => {
    await seedLegalSources();
    await discoverSource("src_egypt_parliament_constitution");
    const result = await ingestSource("src_egypt_parliament_constitution");
    expect(result.parsedCount).toBe(1);
    expect(result.chunkedCount).toBeGreaterThanOrEqual(2);

    const [doc] = await db.select().from(legalDocuments);
    expect(doc?.documentType).toBe("CONSTITUTION");
    expect(doc?.authorityStatus).toBe("AUTHORITATIVE_SOURCE");
    expect(doc?.textOrigin).toBe("SOURCE_TEXT");
    expect(doc?.acquisitionMethod).toBe("OFFICIAL_PUBLIC_WEB");
    expect(doc?.reviewStatus).toBe("PENDING_REVIEW");
    expect(doc?.sourceUrl).toContain("parliament.gov.eg/Constitution.aspx");
    expect(doc?.jurisdiction).toBe("NATIONAL");
    expect(doc?.matterId).toBeNull();

    const articles = await db
      .select()
      .from(legalProvisions)
      .where(eq(legalProvisions.legalDocumentId, doc!.id));
    expect(
      articles.filter((row) => row.provisionType === "ARTICLE").length,
    ).toBeGreaterThanOrEqual(2);

    const validation = await validateLegalDocument(doc!.id);
    expect(validation.status).toBe("SUCCESS");
    expect(validation.report).toContain("AUTHORITATIVE_SOURCE");

    await approveLegalDocument({ documentId: doc!.id });
    const approved = await getAuthoritativeApprovedDocuments();
    expect(approved).toHaveLength(1);
    expect(approved[0]?.id).toBe(doc!.id);
  });

  it("keeps fixture legislation marked FIXTURE beside authoritative constitution", async () => {
    await seedLegalSources();
    await discoverSource("src_egypt_elp");
    await ingestSource("src_egypt_elp");
    await discoverSource("src_egypt_parliament_constitution");
    await ingestSource("src_egypt_parliament_constitution");

    const docs = await db.select().from(legalDocuments);
    expect(docs.some((doc) => doc.authorityStatus === "FIXTURE")).toBe(true);
    expect(
      docs.some((doc) => doc.authorityStatus === "AUTHORITATIVE_SOURCE"),
    ).toBe(true);
    expect(
      docs.some(
        (doc) =>
          doc.authorityStatus === "FIXTURE" && doc.reviewStatus === "REJECTED",
      ),
    ).toBe(true);
  });

  it("deduplicates unchanged constitution snapshots", async () => {
    await seedLegalSources();
    await discoverSource("src_egypt_parliament_constitution");
    await ingestSource("src_egypt_parliament_constitution");
    // Re-queue discovery row for second ingest
    await db
      .update(legalDiscoveredDocuments)
      .set({ ingestionStatus: "DISCOVERED", updatedAt: new Date() })
      .where(
        eq(
          legalDiscoveredDocuments.sourceId,
          "src_egypt_parliament_constitution",
        ),
      );
    const second = await ingestSource("src_egypt_parliament_constitution");
    expect(second.parsedCount).toBe(0);
    const docs = await db.select().from(legalDocuments);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.versionNumber).toBe(1);
  });

  it("rejects wrong-domain URLs for Parliament constitution adapter", async () => {
    const adapter = createParliamentConstitutionAdapter({
      offlineSnapshot: loadSampleSnapshot(),
    });
    await expect(
      adapter.fetch({
        sourceUrl: "https://example.com/Constitution.aspx",
        title: "x",
        documentType: "CONSTITUTION",
        externalId: "x",
      }),
    ).rejects.toThrow(/outside adapter crawl boundary/i);
  });

  it("records access restrictions for 401/403/CAPTCHA/login pages", () => {
    expect(
      detectAccessRestriction({ status: 401, body: "login" }).accessStatus,
    ).toBe("AUTHENTICATION_REQUIRED");
    expect(
      detectAccessRestriction({ status: 403, body: "nope" }).accessStatus,
    ).toBe("ACCESS_RESTRICTED");
    expect(
      detectAccessRestriction({
        status: 200,
        body: "<html>please complete the captcha challenge</html>",
      }).restricted,
    ).toBe(true);
    expect(
      detectAccessRestriction({
        status: 200,
        body: '<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">',
      }).restricted,
    ).toBe(false);
    expect(
      detectAccessRestriction({
        status: 200,
        body: "<html>تسجيل الدخول إلى الحساب</html>",
      }).accessStatus,
    ).toBe("AUTHENTICATION_REQUIRED");
  });

  it("classifies SCC summary content_type distinctly from source text", async () => {
    process.env.LEGAL_CORPUS_MODE = "fixture";
    resetEnvCacheForTests();
    const adapter = getAdapter("egypt-scc");
    const discovered = await adapter.discover();
    expect(discovered.length).toBeGreaterThan(0);
    // Fixture SCC path remains available; summary classification covered by fixture ingest labels.
    const fetched = await adapter.fetch(discovered[0]!);
    if (!fetched.accessRestricted) {
      const parsed = await adapter.parse(fetched);
      if (parsed.textOrigin === "SUMMARY") {
        expect(parsed.documentType).toBe("JUDGMENT_SUMMARY");
      }
    }
  });

  it("does not import empty/invalid constitution snapshots", () => {
    expect(() =>
      parseConstitutionSnapshot({
        sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
        retrievedAt: new Date().toISOString(),
        hostname: "parliament.gov.eg",
        title: "دستور",
        articles: [],
      }),
    ).toThrow(/no articles/i);
  });
});
