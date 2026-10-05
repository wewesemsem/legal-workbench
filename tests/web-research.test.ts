import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  legalChunks,
  legalDocuments,
  legalProvisions,
  legalSources,
  matterMembers,
  matters,
  researchRuns,
  researchSources,
  user,
  workspaceMembers,
  workspaces,
} from "@/lib/db/schema";
import { resetEnvCacheForTests } from "@/lib/env";
import { sha256Hex } from "@/modules/legal-corpus/checksum";
import { persistProvisionsAndChunks } from "@/modules/legal-corpus/persist";
import type { ParsedLegalDocument } from "@/modules/legal-corpus/types";
import { citationsForMarkers } from "@/modules/legal-retrieval/citations";
import { syncLegalRetrievalIndex } from "@/modules/legal-retrieval/index-corpus";
import { runLegalResearch } from "@/modules/legal-retrieval/research";
import { setWebResearchDependenciesForTests } from "@/modules/legal-retrieval/sources/web-research";
import { synthesizeFromEvidence } from "@/modules/legal-retrieval/synthesize";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";
import { classifyWebDomain } from "@/modules/legal-retrieval/web/classify";
import { extractWebPageContent } from "@/modules/legal-retrieval/web/extract";
import {
  MockWebSearchProvider,
  resetMockWebSearchFixtures,
  setMockWebSearchFixtures,
} from "@/modules/legal-retrieval/web/providers/mock";
import { assertSafeHttpUrl, isBlockedIpAddress } from "@/modules/legal-retrieval/web/ssrf";
import type { WebDocument } from "@/modules/legal-retrieval/web/types";

import { resetTestState } from "./helpers";

const SOURCE_ID = "src_test_web_research";
const ARABIC_ARTICLE_53 = "المواطنون لدى القانون سواء، وهم متساوون فى الحقوق والحريات.";

function officialHtml(title: string, body: string): string {
  return `<!doctype html><html lang="ar"><head><title>${title}</title></head><body>
  <nav>Home About Contact</nav>
  <main><article><h1>${title}</h1><p>${body}</p></article></main>
  <footer>Copyright</footer>
  </body></html>`;
}

async function cleanup() {
  const runs = await db.select({ id: researchRuns.id }).from(researchRuns);
  for (const run of runs) {
    await db.delete(researchSources).where(eq(researchSources.researchRunId, run.id));
    await db.delete(researchRuns).where(eq(researchRuns.id, run.id));
  }
  const docs = await db
    .select({ id: legalDocuments.id })
    .from(legalDocuments)
    .where(eq(legalDocuments.sourceId, SOURCE_ID));
  for (const doc of docs) {
    await db.delete(legalChunks).where(eq(legalChunks.legalDocumentId, doc.id));
    await db.delete(legalProvisions).where(eq(legalProvisions.legalDocumentId, doc.id));
    await db.delete(legalDocuments).where(eq(legalDocuments.id, doc.id));
  }
  await db.delete(legalSources).where(eq(legalSources.id, SOURCE_ID));
  await db.delete(matterMembers).where(eq(matterMembers.id, "mm_web_research_a"));
  await db.delete(matterMembers).where(eq(matterMembers.id, "mm_web_research_b"));
  await db.delete(matters).where(eq(matters.id, "matter_web_a"));
  await db.delete(matters).where(eq(matters.id, "matter_web_b"));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, "wm_web_a"));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, "wm_web_b"));
  await db.delete(workspaces).where(eq(workspaces.id, "ws_web_a"));
  await db.delete(workspaces).where(eq(workspaces.id, "ws_web_b"));
  await db.delete(user).where(eq(user.email, "web-research-a@example.com"));
  await db.delete(user).where(eq(user.email, "web-research-b@example.com"));
}

async function seedUsersAndMatters() {
  const now = new Date();
  await db.insert(user).values([
    {
      id: "user_web_a",
      name: "Web A",
      email: "web-research-a@example.com",
      emailVerified: true,
      firstName: "Web",
      lastName: "A",
      role: "LAWYER",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user_web_b",
      name: "Web B",
      email: "web-research-b@example.com",
      emailVerified: true,
      firstName: "Web",
      lastName: "B",
      role: "LAWYER",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(workspaces).values([
    {
      id: "ws_web_a",
      name: "Web WS A",
      createdBy: "user_web_a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ws_web_b",
      name: "Web WS B",
      createdBy: "user_web_b",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(workspaceMembers).values([
    {
      id: "wm_web_a",
      workspaceId: "ws_web_a",
      userId: "user_web_a",
      role: "OWNER",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "wm_web_b",
      workspaceId: "ws_web_b",
      userId: "user_web_b",
      role: "OWNER",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(matters).values([
    {
      id: "matter_web_a",
      workspaceId: "ws_web_a",
      title: "Web Matter A",
      status: "OPEN",
      matterType: "OTHER",
      createdBy: "user_web_a",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "matter_web_b",
      workspaceId: "ws_web_b",
      title: "Web Matter B",
      status: "OPEN",
      matterType: "OTHER",
      createdBy: "user_web_b",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(matterMembers).values([
    {
      id: "mm_web_a",
      matterId: "matter_web_a",
      userId: "user_web_a",
      role: "LAWYER",
      createdAt: now,
    },
    {
      id: "mm_web_b",
      matterId: "matter_web_b",
      userId: "user_web_b",
      role: "LAWYER",
      createdAt: now,
    },
  ]);
}

function constitutionParsed(): ParsedLegalDocument {
  return {
    title: "دستور اختبار",
    documentType: "CONSTITUTION",
    issuingAuthority: "Egyptian Parliament",
    language: "ar",
    textOrigin: "SOURCE_TEXT",
    authorityStatus: "AUTHORITATIVE_SOURCE",
    normalizedText: ARABIC_ARTICLE_53,
    provisions: [
      {
        provisionType: "ARTICLE",
        provisionNumber: "53",
        heading: "مادة (53)",
        text: ARABIC_ARTICLE_53,
        sequence: 1,
        textOrigin: "SOURCE_TEXT",
      },
    ],
  };
}

async function seedConstitution(): Promise<string> {
  await db.insert(legalSources).values({
    id: SOURCE_ID,
    name: "Web research test source",
    authority: "Egyptian Parliament",
    country: "EG",
    jurisdiction: "NATIONAL",
    baseUrl: "https://parliament.gov.eg",
    sourceType: "LEGISLATION",
    accessStatus: "PUBLIC",
    authorityStatus: "AUTHORITATIVE_SOURCE",
    acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
    adapterKey: SOURCE_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const documentId = crypto.randomUUID();
  await db.insert(legalDocuments).values({
    id: documentId,
    sourceId: SOURCE_ID,
    country: "EG",
    jurisdiction: "NATIONAL",
    language: "ar",
    documentType: "CONSTITUTION",
    title: "دستور اختبار",
    issuingAuthority: "Egyptian Parliament",
    status: "IN_FORCE",
    sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
    externalId: documentId,
    checksum: sha256Hex(documentId),
    rawContentHash: sha256Hex(`${documentId}:raw`),
    textOrigin: "SOURCE_TEXT",
    authorityStatus: "AUTHORITATIVE_SOURCE",
    acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
    reviewStatus: "APPROVED",
    reviewedAt: new Date(),
    normalizedText: "دستور اختبار",
    matterId: null,
    ingestionStatus: "CHUNKED",
    versionNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await persistProvisionsAndChunks({
    documentId,
    sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
    parsed: constitutionParsed(),
  });
  await syncLegalRetrievalIndex(documentId);
  return documentId;
}

function authA() {
  return {
    userId: "user_web_a",
    email: "web-research-a@example.com",
    role: "LAWYER" as const,
    firstName: "Web",
    lastName: "A",
  };
}

describe("Phase 10 web research", () => {
  afterEach(async () => {
    setWebResearchDependenciesForTests({ searchProvider: null, fetchPage: null });
    resetMockWebSearchFixtures();
    resetEnvCacheForTests();
    process.env.WEB_SEARCH_PROVIDER = "mock";
    process.env.LEGAL_EMBEDDING_PROVIDER = "mock";
    process.env.LLM_PROVIDER = "mock";
    await cleanup();
  });

  it("classifies official and secondary domains and blocks SSRF targets", () => {
    expect(classifyWebDomain("parliament.gov.eg").authority).toBe("OFFICIAL_PARLIAMENT");
    expect(classifyWebDomain("egypt.gov.eg").authority).toBe("OFFICIAL_GOVERNMENT");
    expect(classifyWebDomain("legalcommentary.example").authority).toBe("SECONDARY_LEGAL");
    expect(classifyWebDomain("random-blog.example").authority).toBe("GENERAL_WEB");
    expect(assertSafeHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(assertSafeHttpUrl("http://localhost/admin").ok).toBe(false);
    expect(assertSafeHttpUrl("http://127.0.0.1/").ok).toBe(false);
    expect(assertSafeHttpUrl("http://192.168.1.10/").ok).toBe(false);
    expect(assertSafeHttpUrl("https://parliament.gov.eg/Constitution.aspx").ok).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
  });

  it("extracts page content and ignores nav/footer boilerplate", () => {
    const extracted = extractWebPageContent({
      url: "https://egypt.gov.eg/law",
      html: officialHtml(
        "Labour Law",
        "Law No. 12 of 2003 regulates employment contracts and worker protections.",
      ),
    });
    expect(extracted.title).toBe("Labour Law");
    expect(extracted.content).toContain("Law No. 12 of 2003");
    expect(extracted.content).not.toContain("Home About Contact");
    expect(extracted.content).not.toContain("Copyright");
  });

  it("treats snippets as discovery only and ranks official sources above secondary", async () => {
    resetTestState();
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanup();
    await seedUsersAndMatters();

    setWebResearchDependenciesForTests({
      searchProvider: new MockWebSearchProvider(),
      fetchPage: async ({ url, sourceName, domain, authorityStatus, publishedAt }) => {
        if (url.includes("legalcommentary")) {
          return {
            ok: false,
            url,
            sourceStatus: "ACCESS_RESTRICTED",
            reason: "access_restricted",
          };
        }
        const body =
          "Official Egyptian government text about Law No. 12 of 2003 employment protections.";
        const html = officialHtml("Official Labour Law Page", body);
        const extracted = extractWebPageContent({ html, url });
        const document: WebDocument = {
          url,
          canonicalUrl: url,
          title: extracted.title,
          sourceName,
          domain,
          publishedAt: publishedAt ?? null,
          retrievedAt: new Date().toISOString(),
          content: extracted.content,
          language: extracted.language,
          contentType: "text/html",
          authorityStatus,
          sourceType: "WEB",
          checksum: extracted.checksum,
          sourceStatus: "FETCHED",
        };
        return { ok: true, document };
      },
    });

    const result = await runLegalResearch({
      query: "What does Law No. 12 of 2003 say?",
      sourceMode: "WEB",
      matterId: "matter_web_a",
      auth: authA(),
    });

    expect(result.researchSources.length).toBeGreaterThan(0);
    expect(result.researchSources.every((source) => source.excerpt !== "Discovery snippet only")).toBe(
      true,
    );
    expect(result.evidence.every((item) => item.sourceKind === "WEB_RESEARCH")).toBe(true);
    expect(result.evidence.every((item) => item.sourceStatus === "FETCHED")).toBe(true);
    expect(result.answer).not.toMatch(/Discovery snippet only/i);
    expect(result.citations.every((citation) => citation.citationKind === "WEB")).toBe(true);
    expect(result.citations.every((citation) => citation.sourceUrl?.startsWith("http"))).toBe(true);

    const official = result.researchSources.find((source) =>
      source.domain.includes("egypt.gov.eg"),
    );
    const secondary = result.researchSources.find((source) =>
      source.domain.includes("legalcommentary"),
    );
    expect(official?.authorityStatus).toBe("OFFICIAL_GOVERNMENT");
    expect(secondary?.sourceStatus).toBe("ACCESS_RESTRICTED");
    expect(official!.relevanceScore).toBeGreaterThan(secondary!.relevanceScore);
  });

  it("supports CORPUS, WEB, BOTH, Arabic/English, and missing-law caveats", async () => {
    resetTestState();
    process.env.WEB_SEARCH_PROVIDER = "mock";
    process.env.LEGAL_EMBEDDING_PROVIDER = "mock";
    process.env.LLM_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanup();
    await seedUsersAndMatters();
    const documentId = await seedConstitution();

    setWebResearchDependenciesForTests({
      searchProvider: new MockWebSearchProvider(),
      fetchPage: async ({ url, sourceName, domain, authorityStatus, publishedAt }) => {
        const html = officialHtml(
          "Equality page",
          "المواطنون متساوون. Equality before the law is a constitutional principle.",
        );
        const extracted = extractWebPageContent({ html, url });
        return {
          ok: true,
          document: {
            url,
            canonicalUrl: url,
            title: extracted.title,
            sourceName,
            domain,
            publishedAt: publishedAt ?? null,
            retrievedAt: new Date().toISOString(),
            content: extracted.content,
            language: extracted.language,
            contentType: "text/html",
            authorityStatus,
            sourceType: "WEB",
            checksum: extracted.checksum + url,
            sourceStatus: "FETCHED",
          },
        };
      },
    });

    const corpus = await runLegalResearch({
      query: "Find the constitutional provision concerning equality.",
      sourceMode: "CORPUS",
      matterId: "matter_web_a",
      auth: authA(),
      filters: { legalDocumentId: documentId },
    });
    expect(corpus.evidenceSufficient).toBe(true);
    expect(corpus.answer).toContain(ARABIC_ARTICLE_53);
    expect(corpus.citations[0]?.citationKind).toBe("LEGAL_CORPUS");
    expect(corpus.metadata.webEvidenceCount).toBe(0);

    const both = await runLegalResearch({
      query: "What does the Constitution say about equality?",
      sourceMode: "BOTH",
      matterId: "matter_web_a",
      auth: authA(),
      filters: { legalDocumentId: documentId },
    });
    expect(both.metadata.corpusEvidenceCount).toBeGreaterThan(0);
    expect(both.metadata.webDiscoveryCount).toBeGreaterThan(0);
    expect(both.evidence.some((item) => item.sourceKind === "LEGAL_CORPUS")).toBe(true);

    const arabic = await runLegalResearch({
      query: "ما هي أحكام المساواة في الدستور؟",
      sourceMode: "BOTH",
      matterId: "matter_web_a",
      auth: authA(),
      filters: { legalDocumentId: documentId },
    });
    expect(arabic.evidence.length + arabic.researchSources.length).toBeGreaterThan(0);

    const missing = await runLegalResearch({
      query: "What does Article 25 of Law 12 of 2003 say?",
      sourceMode: "BOTH",
      matterId: "matter_web_a",
      auth: authA(),
    });
    expect(missing.metadata.corpusLimitation).toMatch(/Law No\. 12 of 2003/i);
    expect(missing.answer).toMatch(/indexed|corpus|additional sources/i);
    expect(missing.answer).not.toMatch(/does not exist/i);

    const runs = await db
      .select()
      .from(researchRuns)
      .where(eq(researchRuns.matterId, "matter_web_a"));
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((run) => run.matterId === "matter_web_a")).toBe(true);
  });

  it("enforces matter isolation and rejects cross-matter research", async () => {
    resetTestState();
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanup();
    await seedUsersAndMatters();

    await expect(
      runLegalResearch({
        query: "equality",
        sourceMode: "WEB",
        matterId: "matter_web_b",
        auth: authA(),
      }),
    ).rejects.toThrow(/matter/i);

    const owned = await runLegalResearch({
      query: "zzzz-no-match-query",
      sourceMode: "WEB",
      matterId: "matter_web_a",
      auth: authA(),
    });
    expect(owned.researchRunId).toBeTruthy();

    const foreign = await db
      .select()
      .from(researchRuns)
      .where(
        and(eq(researchRuns.matterId, "matter_web_b"), eq(researchRuns.userId, "user_web_a")),
      );
    expect(foreign).toEqual([]);
  });

  it("requires matter_id for WEB/BOTH and keeps grounding citation-bound", async () => {
    resetTestState();
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanup();
    await seedUsersAndMatters();

    await expect(
      runLegalResearch({
        query: "Law 12 of 2003",
        sourceMode: "WEB",
        auth: authA(),
      }),
    ).rejects.toThrow(/matter_id/i);

    const evidence: LegalEvidence[] = [
      {
        sourceKind: "WEB_RESEARCH",
        chunkId: "web:1",
        documentId: "webdoc:1",
        provisionId: "webpass:1",
        title: "Official page",
        heading: null,
        provisionType: null,
        provisionNumber: null,
        text: "Official text about equality.",
        score: 1,
        sourceUrl: "https://egypt.gov.eg/equality",
        authorityStatus: "OFFICIAL_GOVERNMENT",
        language: "en",
        hierarchyPath: null,
        documentType: "WEB",
        country: "EG",
        jurisdiction: "WEB",
        issuingAuthority: "Egyptian Government",
        date: null,
        domain: "egypt.gov.eg",
        sourceName: "Egyptian Government",
        webAuthority: "OFFICIAL_GOVERNMENT",
        sourceStatus: "FETCHED",
        retrievedAt: new Date().toISOString(),
      },
    ];
    const synthesized = synthesizeFromEvidence({
      query: "equality",
      evidence,
      corpusLimitation: "The indexed legal corpus does not contain Law No. 12 of 2003.",
    });
    const citations = citationsForMarkers(synthesized.markers, evidence);
    expect(citations).toHaveLength(1);
    expect(citations[0]?.sourceUrl).toBe("https://egypt.gov.eg/equality");
    expect(synthesized.answer).toContain("Additional research");
    expect(synthesized.answer).toContain("Caveat");
  });

  it("deduplicates URLs and does not ingest web pages into legal corpus", async () => {
    resetTestState();
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanup();
    await seedUsersAndMatters();

    setMockWebSearchFixtures([
      {
        queryIncludes: ["duplicate"],
        results: [
          {
            url: "https://egypt.gov.eg/page",
            title: "Page",
            snippet: "same",
            sourceName: "egypt.gov.eg",
            domain: "egypt.gov.eg",
            publishedAt: null,
            metadata: {},
          },
          {
            url: "https://egypt.gov.eg/page/",
            title: "Page trailing",
            snippet: "same",
            sourceName: "egypt.gov.eg",
            domain: "egypt.gov.eg",
            publishedAt: null,
            metadata: {},
          },
        ],
      },
    ]);

    setWebResearchDependenciesForTests({
      searchProvider: new MockWebSearchProvider(),
      fetchPage: async ({ url, sourceName, domain, authorityStatus }) => {
        const html = officialHtml("Dup", "Duplicate content body for Law research.");
        const extracted = extractWebPageContent({ html, url });
        return {
          ok: true,
          document: {
            url,
            canonicalUrl: url.replace(/\/$/, ""),
            title: extracted.title,
            sourceName,
            domain,
            publishedAt: null,
            retrievedAt: new Date().toISOString(),
            content: extracted.content,
            language: "en",
            contentType: "text/html",
            authorityStatus,
            sourceType: "WEB",
            checksum: "same-checksum",
            sourceStatus: "FETCHED",
          },
        };
      },
    });

    const before = await db.select({ id: legalDocuments.id }).from(legalDocuments);
    const result = await runLegalResearch({
      query: "duplicate research",
      sourceMode: "WEB",
      matterId: "matter_web_a",
      auth: authA(),
    });
    const after = await db.select({ id: legalDocuments.id }).from(legalDocuments);
    expect(after.length).toBe(before.length);
    expect(result.researchSources.length).toBe(1);
  });

  it("handles empty web results and inaccessible pages without hallucinated citations", async () => {
    resetTestState();
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanup();
    await seedUsersAndMatters();

    setMockWebSearchFixtures([
      {
        queryIncludes: ["emptycase"],
        results: [],
      },
    ]);
    setWebResearchDependenciesForTests({
      searchProvider: new MockWebSearchProvider(),
    });

    const empty = await runLegalResearch({
      query: "emptycase query",
      sourceMode: "WEB",
      matterId: "matter_web_a",
      auth: authA(),
    });
    expect(empty.evidenceSufficient).toBe(false);
    expect(empty.citations).toEqual([]);
    expect(empty.answer).toMatch(/no sufficient/i);

    setMockWebSearchFixtures([
      {
        queryIncludes: ["blocked"],
        results: [
          {
            url: "https://egypt.gov.eg/secret",
            title: "Secret",
            snippet: "hidden",
            sourceName: "egypt.gov.eg",
            domain: "egypt.gov.eg",
            publishedAt: null,
            metadata: {},
          },
        ],
      },
    ]);
    setWebResearchDependenciesForTests({
      searchProvider: new MockWebSearchProvider(),
      fetchPage: async ({ url }) => ({
        ok: false,
        url,
        sourceStatus: "ACCESS_RESTRICTED",
        reason: "access_restricted",
      }),
    });
    const blocked = await runLegalResearch({
      query: "blocked page",
      sourceMode: "WEB",
      matterId: "matter_web_a",
      auth: authA(),
    });
    expect(blocked.evidence).toEqual([]);
    expect(blocked.researchSources[0]?.sourceStatus).toBe("ACCESS_RESTRICTED");
    expect(blocked.citations).toEqual([]);
  });
});
