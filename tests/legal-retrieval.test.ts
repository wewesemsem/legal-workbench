import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  documents,
  legalChunks,
  legalDocuments,
  legalProvisions,
  legalSources,
  matters,
  user,
  workspaces,
} from "@/lib/db/schema";
import { LEGAL_VECTOR_DIMENSIONS } from "@/lib/db/schema/vector";
import { resetEnvCacheForTests } from "@/lib/env";
import { sha256Hex } from "@/modules/legal-corpus/checksum";
import { parseConstitutionSnapshot } from "@/modules/legal-corpus/constitution";
import {
  assignHierarchyPaths,
  collectProvisions,
  linkStoredProvisions,
} from "@/modules/legal-corpus/hierarchy";
import { persistProvisionsAndChunks } from "@/modules/legal-corpus/persist";
import type { ParsedLegalDocument } from "@/modules/legal-corpus/types";
import { askLegalQuestion } from "@/modules/legal-retrieval/answer";
import {
  lexicalSearchVariants,
  normalizeArabicForSearch,
} from "@/modules/legal-retrieval/arabic-normalize";
import {
  citationsForMarkers,
  unsupportedArticleNumbers,
} from "@/modules/legal-retrieval/citations";
import { embedWithHash } from "@/modules/legal-retrieval/embeddings/hash";
import { resetEmbeddingProviderForTests } from "@/modules/legal-retrieval/embeddings";
import { resetLegalEmbeddingServiceForTests } from "@/modules/legal-retrieval/embedding-service";
import { canReuseEmbedding, combineHybridScores } from "@/modules/legal-retrieval/hybrid-rank";
import { syncLegalRetrievalIndex } from "@/modules/legal-retrieval/index-corpus";
import { detectLegalReferences } from "@/modules/legal-retrieval/references";
import {
  corpusQueryFromIntent,
  parseRetrievalIntent,
  resolveRetrievalIntent,
} from "@/modules/legal-retrieval/resolve-intent";
import { buildRetrievalText } from "@/modules/legal-retrieval/retrieval-text";
import { createLegalRetrievalRouter } from "@/modules/legal-retrieval/router";
import { searchLegalCorpus } from "@/modules/legal-retrieval/service";
import {
  createAgentModelGateway,
  resetAgentModelGatewayForTests,
  type AgentModelGateway,
} from "@/modules/agents/model-gateway";
import { MatterDocumentRetrievalSource } from "@/modules/legal-retrieval/sources/matter";
import { WebResearchRetrievalSource } from "@/modules/legal-retrieval/sources/web-research";
import { synthesizeFromEvidence } from "@/modules/legal-retrieval/synthesize";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";

import { resetTestState } from "./helpers";

const SOURCE_ID = "src_test_legal_retrieval";
const ARABIC_ARTICLE_1 =
  "جمهورية مصر العربية دولة ذات سيادة، وهى موحدة لا تقبل التجزئة.";
const ARABIC_ARTICLE_2 =
  "الإسلام دين الدولة، واللغة العربية لغتها الرسمية، ومبادئ الشريعة الإسلامية المصدر الرئيسى للتشريع.";
const ARABIC_ARTICLE_3 =
  "مبادئ شرائع المصريين من المسيحيين واليهود المصدر الرئيسى لأحوالهم الشخصية.";
const ARABIC_ARTICLE_4 = "السيادة للشعب وحده، وهو مصدر السلطات.";
const ARABIC_ARTICLE_5 =
  "يقوم النظام السياسى على أساس التعددية السياسية والحزبية.";
const ARABIC_ARTICLE_25 =
  "تلتزم الدولة بوضع خطة شاملة للقضاء على الأمية الهجائية والرقمية؛ بين المواطنين.";
const ARABIC_ARTICLE_19 = "التعليم حق لكل مواطن، وهدف التعليم بناء الشخصية المصرية.";
const ARABIC_ARTICLE_53 = "المواطنون لدى القانون سواء، وهم متساوون فى الحقوق والحريات.";
const ARABIC_ARTICLE_227 =
  "يشكل الدستور بديباجته و جميع نصوصه نسيجًا مترابطًا، وكلاً لا يتجزأ.";

async function cleanupRetrievalFixtures() {
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

  const matterRows = await db
    .select({ id: matters.id })
    .from(matters)
    .where(eq(matters.title, "Retrieval isolation matter"));
  for (const matter of matterRows) {
    await db.delete(documents).where(eq(documents.matterId, matter.id));
    await db.delete(matters).where(eq(matters.id, matter.id));
  }
  const workspaceRows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, "Retrieval isolation workspace"));
  for (const workspace of workspaceRows) {
    await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
  }
  await db.delete(user).where(eq(user.email, "retrieval-isolation@example.com"));
}

function constitutionParsed(): ParsedLegalDocument {
  const stateArticles = [
    ["1", ARABIC_ARTICLE_1],
    ["2", ARABIC_ARTICLE_2],
    ["3", ARABIC_ARTICLE_3],
    ["4", ARABIC_ARTICLE_4],
    ["5", ARABIC_ARTICLE_5],
  ] as const;
  return {
    title: "دستور جمهورية مصر العربية",
    documentType: "CONSTITUTION",
    issuingAuthority: "Egyptian Parliament",
    language: "ar",
    textOrigin: "SOURCE_TEXT",
    authorityStatus: "AUTHORITATIVE_SOURCE",
    normalizedText: [
      ARABIC_ARTICLE_1,
      ARABIC_ARTICLE_2,
      ARABIC_ARTICLE_3,
      ARABIC_ARTICLE_4,
      ARABIC_ARTICLE_5,
      ARABIC_ARTICLE_19,
      ARABIC_ARTICLE_25,
      ARABIC_ARTICLE_53,
      ARABIC_ARTICLE_227,
    ].join("\n"),
    provisions: [
      {
        provisionType: "PART",
        heading: "الباب الأول - الدولة",
        text: "الباب الأول - الدولة",
        sequence: 1,
        textOrigin: "SOURCE_TEXT",
        children: stateArticles.map(([number, text], index) => ({
          provisionType: "ARTICLE" as const,
          provisionNumber: number,
          heading: `مادة (${number})`,
          text,
          sequence: index + 2,
          textOrigin: "SOURCE_TEXT" as const,
        })),
      },
      {
        provisionType: "PART",
        heading: "الباب الثالث - الحقوق والحريات والواجبات العامه",
        text: "الباب الثالث - الحقوق والحريات والواجبات العامه",
        sequence: 10,
        textOrigin: "SOURCE_TEXT",
        children: [
          {
            provisionType: "ARTICLE",
            provisionNumber: "53",
            heading: "مادة (53)",
            text: ARABIC_ARTICLE_53,
            sequence: 11,
            textOrigin: "SOURCE_TEXT",
          },
        ],
      },
      {
        provisionType: "PART",
        heading: "الباب الثانى- المقومات الاساسية للمجتمع",
        text: "الباب الثانى- المقومات الاساسية للمجتمع",
        sequence: 12,
        textOrigin: "SOURCE_TEXT",
        children: [
          {
            provisionType: "CHAPTER",
            heading: "الفصل الأول - المقومات الاجتماعية",
            text: "الفصل الأول - المقومات الاجتماعية",
            sequence: 13,
            textOrigin: "SOURCE_TEXT",
            children: [
              {
                provisionType: "ARTICLE",
                provisionNumber: "19",
                heading: "مادة (19)",
                text: ARABIC_ARTICLE_19,
                sequence: 14,
                textOrigin: "SOURCE_TEXT",
              },
              {
                provisionType: "ARTICLE",
                provisionNumber: "25",
                heading: "مادة (25)",
                text: ARABIC_ARTICLE_25,
                sequence: 15,
                textOrigin: "SOURCE_TEXT",
              },
            ],
          },
        ],
      },
      {
        provisionType: "PART",
        heading: "الباب السادس - الأحكام العامة والانتقالية",
        text: "الباب السادس - الأحكام العامة والانتقالية",
        sequence: 16,
        textOrigin: "SOURCE_TEXT",
        children: [
          {
            provisionType: "ARTICLE",
            provisionNumber: "227",
            heading: "مادة (227)",
            text: ARABIC_ARTICLE_227,
            sequence: 17,
            textOrigin: "SOURCE_TEXT",
          },
        ],
      },
    ],
  };
}

async function insertSource() {
  await db.insert(legalSources).values({
    id: SOURCE_ID,
    name: "Retrieval test source",
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
}

async function insertDocument(input: {
  id: string;
  title: string;
  documentType: ParsedLegalDocument["documentType"];
  authorityStatus: "AUTHORITATIVE_SOURCE" | "FIXTURE";
  textOrigin: "SOURCE_TEXT" | "FIXTURE";
  reviewStatus?: "APPROVED" | "PENDING_REVIEW";
  documentNumber?: string;
  year?: number;
  matterId?: string | null;
  sourceUrl?: string;
}) {
  await db.insert(legalDocuments).values({
    id: input.id,
    sourceId: SOURCE_ID,
    country: "EG",
    jurisdiction: "NATIONAL",
    language: "ar",
    documentType: input.documentType,
    title: input.title,
    documentNumber: input.documentNumber ?? null,
    year: input.year ?? null,
    issuingAuthority: "Egyptian Parliament",
    status: "IN_FORCE",
    sourceUrl: input.sourceUrl ?? "https://parliament.gov.eg/Constitution.aspx",
    externalId: input.id,
    checksum: sha256Hex(input.id),
    rawContentHash: sha256Hex(`${input.id}:raw`),
    textOrigin: input.textOrigin,
    authorityStatus: input.authorityStatus,
    acquisitionMethod:
      input.authorityStatus === "FIXTURE" ? "FIXTURE" : "OFFICIAL_PUBLIC_WEB",
    reviewStatus: input.reviewStatus ?? "APPROVED",
    reviewedAt: new Date(),
    normalizedText: input.title,
    matterId: input.matterId ?? null,
    ingestionStatus: "CHUNKED",
    versionNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("legal retrieval", () => {
  afterEach(async () => {
    resetTestState();
    resetEnvCacheForTests();
    resetEmbeddingProviderForTests();
    resetLegalEmbeddingServiceForTests();
    await cleanupRetrievalFixtures();
  });

  it("builds constitution hierarchy paths without inventing missing levels", () => {
    const sample = parseConstitutionSnapshot({
      sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
      retrievedAt: "2026-10-03T00:00:00.000Z",
      hostname: "parliament.gov.eg",
      title: "دستور جمهورية مصر العربية",
      articles: [
        {
          number: "1",
          text: "جمهورية مصر العربية دولة ذات سيادة.",
          bab: "الباب الاول - الدولة",
          label: "مادة (1)",
        },
        {
          number: "151",
          text: "يمثل رئيس الجمهورية الدولة.",
          bab: "الباب الخامس - نظام الحكم",
          chapter: "الفصل الثانى - السلطة التنفيذية",
          label: "مادة (151)",
        },
      ],
    });
    const articles = collectProvisions(sample.provisions).filter(
      (provision) => provision.provisionType === "ARTICLE",
    );
    expect(articles).toHaveLength(2);
    expect(articles[0]?.text).toBe("جمهورية مصر العربية دولة ذات سيادة.");

    const nodes = assignHierarchyPaths(sample.documentType, sample.provisions);
    expect(
      nodes.find((node) => node.provision.provisionNumber === "1")?.hierarchyPath,
    ).toBe("constitution.part_1.article_1");
    expect(
      nodes.find((node) => node.provision.provisionNumber === "151")?.hierarchyPath,
    ).toBe("constitution.part_5.chapter_2.article_151");
    expect(nodes.some((node) => node.hierarchyPath.includes("title_"))).toBe(false);
  });

  it("links stored part, chapter, and article rows", () => {
    const links = linkStoredProvisions("CONSTITUTION", [
      {
        id: "part",
        parentId: null,
        provisionType: "PART",
        provisionNumber: null,
        heading: "الباب الثانى- المقومات الاساسية للمجتمع",
        sequence: 1,
      },
      {
        id: "chapter",
        parentId: null,
        provisionType: "CHAPTER",
        provisionNumber: null,
        heading: "الفصل الأول - المقومات الاجتماعية",
        sequence: 2,
      },
      {
        id: "article",
        parentId: null,
        provisionType: "ARTICLE",
        provisionNumber: "25",
        heading: "مادة (25)",
        sequence: 3,
      },
    ]);
    expect(links.get("chapter")?.parentId).toBe("part");
    expect(links.get("article")?.parentId).toBe("chapter");
    expect(links.get("article")?.hierarchyPath).toBe(
      "constitution.part_2.chapter_1.article_25",
    );
  });

  it("parses retrieval intent and applies inferred article overrides", async () => {
    expect(
      parseRetrievalIntent(
        {
          retrievalQuery: "Article 1 Egyptian Constitution",
          articleNumbers: ["1"],
          documentType: "CONSTITUTION",
          userGoal: "Quote the opening of the constitution",
        },
        "whats the first sentence of the constitution",
      ),
    ).toMatchObject({
      retrievalQuery: "Article 1 Egyptian Constitution",
      articleNumbers: ["1"],
      documentType: "CONSTITUTION",
      source: "ai",
    });

    expect(parseRetrievalIntent({ retrievalQuery: "" }, "x")).toBeNull();

    expect(
      corpusQueryFromIntent({
        toolQuery: "whats the first sentence of the constitution",
        userTask: "whats the first sentence of the constitution",
        intent: {
          originalQuery: "whats the first sentence of the constitution",
          retrievalQuery: "Article 1 Egyptian Constitution",
          articleNumbers: ["1"],
          documentType: "CONSTITUTION",
          userGoal: "opening text",
          source: "ai",
        },
      }),
    ).toBe("Article 1 Egyptian Constitution");

    resetTestState();
    process.env.LEGAL_EMBEDDING_PROVIDER = "mock";
    process.env.LLM_PROVIDER = "mock";
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanupRetrievalFixtures();
    await insertSource();

    const constitutionId = crypto.randomUUID();
    await insertDocument({
      id: constitutionId,
      title: "دستور جمهورية مصر العربية",
      documentType: "CONSTITUTION",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      textOrigin: "SOURCE_TEXT",
    });
    await persistProvisionsAndChunks({
      documentId: constitutionId,
      sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
      parsed: constitutionParsed(),
    });
    await syncLegalRetrievalIndex(constitutionId);

    const naturalLanguage = "whats the first sentence of the constitution";
    expect(
      detectLegalReferences(naturalLanguage).hasExplicitArticleReference,
    ).toBe(false);

    const overridden = await searchLegalCorpus({
      query: naturalLanguage,
      articleNumbers: ["1"],
      documentType: "CONSTITUTION",
      filters: { legalDocumentId: constitutionId },
    });
    expect(overridden.evidence.map((item) => item.provisionNumber)).toEqual([
      "1",
    ]);
    expect(overridden.evidence[0]?.text).toBe(ARABIC_ARTICLE_1);

    const stubGateway: AgentModelGateway = {
      async generate() {
        return { content: "", provider: "mock", model: "mock" };
      },
      async structuredOutput() {
        return {
          retrievalQuery: "Article 1 Egyptian Constitution",
          articleNumbers: ["1"],
          documentType: "CONSTITUTION",
          userGoal: "Quote the first sentence of the constitution",
        };
      },
      async chooseNextAction() {
        return { type: "finalize", summary: "unused" };
      },
    };
    resetAgentModelGatewayForTests(stubGateway);
    try {
      const intent = await resolveRetrievalIntent(naturalLanguage);
      expect(intent.source).toBe("ai");
      expect(intent.articleNumbers).toContain("1");
      const viaIntent = await searchLegalCorpus({
        query: intent.retrievalQuery,
        articleNumbers: intent.articleNumbers,
        documentType: intent.documentType,
        filters: { legalDocumentId: constitutionId },
      });
      expect(viaIntent.evidence[0]?.provisionNumber).toBe("1");
      expect(viaIntent.evidence[0]?.text).toBe(ARABIC_ARTICLE_1);
    } finally {
      resetAgentModelGatewayForTests(createAgentModelGateway());
    }
  });

  it("detects exact article and law references", () => {
    expect(detectLegalReferences("What does Article 25 of the Constitution say?"))
      .toMatchObject({
        articleNumbers: ["25"],
        mentionsConstitution: true,
        hasExplicitArticleReference: true,
        laws: [],
      });
    expect(detectLegalReferences("ماذا تقول المادة ٢٥؟").articleNumbers).toEqual(["25"]);
    expect(detectLegalReferences("Art. 1 of the Constitution").articleNumbers).toEqual([
      "1",
    ]);
    expect(
      detectLegalReferences("What is the first article of the Constitution?")
        .articleNumbers,
    ).toEqual(["1"]);
    expect(
      detectLegalReferences("What is Article One of the Egyptian Constitution?")
        .articleNumbers,
    ).toEqual(["1"]);
    expect(
      detectLegalReferences("ماذا تقول المادة الأولى من الدستور؟").articleNumbers,
    ).toEqual(["1"]);
    expect(
      detectLegalReferences("ما هي المادة الثانية؟").articleNumbers,
    ).toEqual(["2"]);
    expect(
      detectLegalReferences("المادة رقم 1 من الدستور").articleNumbers,
    ).toEqual(["1"]);
    expect(
      detectLegalReferences("Show me Articles 1 through 5.").articleNumbers,
    ).toEqual(["1", "2", "3", "4", "5"]);
    expect(
      detectLegalReferences("ما هي المواد من 1 إلى 5؟").articleNumbers,
    ).toEqual(["1", "2", "3", "4", "5"]);
    expect(
      detectLegalReferences(
        "What constitutional provisions discuss the identity of the Egyptian state?",
      ).hasExplicitArticleReference,
    ).toBe(false);
    expect(
      detectLegalReferences("What does Article 25 of Law 12 of 2003 say?").laws,
    ).toEqual([{ number: "12", year: "2003" }]);
    expect(
      detectLegalReferences("القانون رقم 12 لسنة 2003").laws,
    ).toEqual([{ number: "12", year: "2003" }]);
  });

  it("pins query-exact articles ahead of higher-scoring distractors", async () => {
    const { orderEvidenceForAnswer } = await import(
      "@/modules/legal-retrieval/evidence-order"
    );
    const { synthesizeFromEvidence } = await import(
      "@/modules/legal-retrieval/synthesize"
    );
    const article2 = {
      sourceKind: "LEGAL_CORPUS" as const,
      chunkId: "chunk-art-2",
      documentId: "doc-const",
      provisionId: "prov-2",
      title: "Egyptian Constitution",
      heading: "مادة (2)",
      provisionType: "ARTICLE",
      provisionNumber: "2",
      text: "الإسلام دين الدولة، واللغة العربية لغتها الرسمية.",
      score: 9,
      sourceUrl: null,
      authorityStatus: "AUTHORITATIVE_SOURCE",
      language: "ar",
      hierarchyPath: "constitution.part_1.article_2",
      documentType: "CONSTITUTION",
      country: "EG",
      jurisdiction: "EG",
      issuingAuthority: "Egypt",
      date: null,
    };
    const article1 = {
      ...article2,
      chunkId: "chunk-art-1",
      provisionId: "prov-1",
      heading: "مادة (1)",
      provisionNumber: "1",
      text: "جمهورية مصر العربية دولة ذات سيادة.",
      score: 1,
      hierarchyPath: "constitution.part_1.article_1",
    };

    const ordered = orderEvidenceForAnswer(
      "What does Article 1 of the Egyptian Constitution say?",
      [article2, article1],
    );
    expect(ordered[0]?.provisionNumber).toBe("1");

    const synthesized = synthesizeFromEvidence({
      query: "What does Article 1 of the Egyptian Constitution say?",
      evidence: [article2, article1],
    });
    expect(synthesized.answer).toContain("Article 1");
    expect(synthesized.answer).toContain("جمهورية مصر العربية");
    expect(synthesized.answer.indexOf("Article 1")).toBeLessThan(
      synthesized.answer.indexOf("Article 2") === -1
        ? Number.POSITIVE_INFINITY
        : synthesized.answer.indexOf("Article 2"),
    );
  });

  it("merges keyword and vector scores deterministically and boosts exact matches", () => {
    const input = {
      keyword: [
        { id: "semantic", score: 0.4 },
        { id: "exact", score: 0.2 },
      ],
      vector: [
        { id: "semantic", score: 0.95 },
        { id: "exact", score: 0.2 },
      ],
      keywordWeight: 0.45,
      vectorWeight: 0.55,
      boosts: new Map([["exact", 3]]),
    };
    const first = combineHybridScores(input);
    const second = combineHybridScores(input);
    expect(first.map((hit) => hit.id)).toEqual(second.map((hit) => hit.id));
    expect(first[0]?.id).toBe("exact");
    expect(first[0]?.hybridScore).toBeGreaterThan(first[1]?.hybridScore ?? 0);
  });

  it("keeps citations bound to retrieved evidence", () => {
    const evidence = [
      {
        sourceKind: "LEGAL_CORPUS",
        chunkId: "chunk-25",
        documentId: "doc-1",
        provisionId: "prov-25",
        title: "دستور جمهورية مصر العربية",
        heading: "مادة (25)",
        provisionType: "ARTICLE",
        provisionNumber: "25",
        text: ARABIC_ARTICLE_25,
        score: 3.4,
        sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
        authorityStatus: "AUTHORITATIVE_SOURCE",
        language: "ar",
        hierarchyPath: "constitution.part_2.chapter_1.article_25",
        documentType: "CONSTITUTION",
        country: "EG",
        jurisdiction: "NATIONAL",
        issuingAuthority: "Egyptian Parliament",
        date: null,
      },
    ] satisfies LegalEvidence[];

    const citations = citationsForMarkers(["S9", "S1"], evidence);
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      citationKind: "LEGAL_CORPUS",
      legalChunkId: "chunk-25",
      legalProvisionId: "prov-25",
      legalDocumentId: "doc-1",
      sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
      provisionLabel: "Article 25",
    });
    expect(unsupportedArticleNumbers("Article 26 grants a right", evidence)).toEqual([
      "26",
    ]);
    expect(unsupportedArticleNumbers("Article 25 is the retrieved text", evidence)).toEqual(
      [],
    );
  });

  it("reuses embeddings only when content and model are unchanged", () => {
    expect(
      canReuseEmbedding({
        previousHash: "abc",
        nextHash: "abc",
        previousModel: "local-hash-v1",
        nextModel: "local-hash-v1",
        previousVersion: "1",
        nextVersion: "1",
        hasEmbedding: true,
      }),
    ).toBe(true);
    expect(
      canReuseEmbedding({
        previousHash: "abc",
        nextHash: "changed",
        previousModel: "local-hash-v1",
        nextModel: "local-hash-v1",
        previousVersion: "1",
        nextVersion: "1",
        hasEmbedding: true,
      }),
    ).toBe(false);
    expect(
      canReuseEmbedding({
        previousHash: "abc",
        nextHash: "abc",
        previousModel: "local-hash-v1",
        nextModel: "text-embedding-3-small",
        previousVersion: "1",
        nextVersion: "1",
        hasEmbedding: true,
      }),
    ).toBe(false);

    const stable = embedWithHash(ARABIC_ARTICLE_25);
    expect(embedWithHash(ARABIC_ARTICLE_25)).toEqual(stable);
    expect(embedWithHash(`${ARABIC_ARTICLE_25} زيادة`)).not.toEqual(stable);
    expect(stable).toHaveLength(LEGAL_VECTOR_DIMENSIONS);
  });

  it("leaves Arabic source text intact in retrieval text", () => {
    const retrieval = buildRetrievalText({
      documentTitle: "دستور جمهورية مصر العربية",
      documentType: "CONSTITUTION",
      ancestors: [],
      provisionType: "ARTICLE",
      provisionNumber: "25",
      heading: "مادة (25)",
      sourceText: ARABIC_ARTICLE_25,
    });
    expect(retrieval.endsWith(ARABIC_ARTICLE_25)).toBe(true);
    expect(retrieval).toContain("؛");
    expect(retrieval).not.toContain("illiteracy");
  });

  it("normalizes Arabic for search without mutating source text", () => {
    const source = "المادة ٢٥ — آفاق التعليمـة";
    expect(normalizeArabicForSearch(source)).toBe("الماده 25 — افاق التعليمه");
    expect(source).toBe("المادة ٢٥ — آفاق التعليمـة");
    expect(lexicalSearchVariants("التعليم")).toEqual(["التعليم"]);
    expect(lexicalSearchVariants("آفاق")).toEqual(["آفاق", "افاق"]);
  });

  it("synthesizes a grounded answer with source-supported phrasing and citations", () => {
    const evidence = [
      {
        sourceKind: "LEGAL_CORPUS" as const,
        chunkId: "chunk-19",
        documentId: "doc-1",
        provisionId: "prov-19",
        title: "دستور جمهورية مصر العربية",
        heading: "مادة (19)",
        provisionType: "ARTICLE",
        provisionNumber: "19",
        text: "التعليم حق لكل مواطن، هدفه بناء الشخصية المصرية.",
        score: 1.2,
        sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
        authorityStatus: "AUTHORITATIVE_SOURCE",
        language: "ar",
        hierarchyPath: "constitution.part_2.chapter_1.article_19",
        documentType: "CONSTITUTION",
        country: "EG",
        jurisdiction: "NATIONAL",
        issuingAuthority: "Egyptian Parliament",
        date: null,
      },
    ];
    const synthesized = synthesizeFromEvidence({
      query: "What does the Constitution say about education?",
      evidence,
    });
    expect(synthesized.answer).toContain("The Constitution provides");
    expect(synthesized.answer).toContain("[S1]");
    expect(synthesized.answer).toContain("التعليم حق لكل مواطن");
    expect(synthesized.answer).toContain("Source-supported");
    expect(synthesized.markers).toEqual(["S1"]);
    expect(citationsForMarkers(synthesized.markers, evidence)[0]?.legalChunkId).toBe(
      "chunk-19",
    );
  });

  it("registers web research separately and refuses matter search without access", async () => {
    expect(createLegalRetrievalRouter().kinds()).toEqual(["LEGAL_CORPUS", "WEB_RESEARCH"]);
    expect(createLegalRetrievalRouter({ includeWeb: false }).kinds()).toEqual(["LEGAL_CORPUS"]);
    const web = await new WebResearchRetrievalSource().searchDetailed({
      query: "zzzz-no-match-query",
    });
    expect(web.evidence).toEqual([]);
    await expect(new MatterDocumentRetrievalSource().search({ query: "secret" })).rejects.toThrow(
      /matter/i,
    );
  });

  it("retrieves the exact article, excludes fixtures, and refuses a missing law", async () => {
    resetTestState();
    process.env.LEGAL_EMBEDDING_PROVIDER = "mock";
    process.env.LLM_PROVIDER = "mock";
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanupRetrievalFixtures();
    await insertSource();

    const constitutionId = crypto.randomUUID();
    await insertDocument({
      id: constitutionId,
      title: "دستور جمهورية مصر العربية",
      documentType: "CONSTITUTION",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      textOrigin: "SOURCE_TEXT",
    });
    await persistProvisionsAndChunks({
      documentId: constitutionId,
      sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
      parsed: constitutionParsed(),
    });

    const fixtureId = crypto.randomUUID();
    await insertDocument({
      id: fixtureId,
      title: "قانون رقم 12 لسنة 2003",
      documentType: "LEGISLATION",
      authorityStatus: "FIXTURE",
      textOrigin: "FIXTURE",
      reviewStatus: "APPROVED",
      documentNumber: "12",
      year: 2003,
      sourceUrl: "https://example.test/fixture-law",
    });
    await persistProvisionsAndChunks({
      documentId: fixtureId,
      sourceUrl: "https://example.test/fixture-law",
      parsed: {
        title: "قانون رقم 12 لسنة 2003",
        documentType: "LEGISLATION",
        issuingAuthority: "Fixture",
        language: "ar",
        textOrigin: "FIXTURE",
        authorityStatus: "FIXTURE",
        normalizedText: "FIXTURE_ONLY_MARKER",
        provisions: [
          {
            provisionType: "ARTICLE",
            provisionNumber: "25",
            heading: "المادة 25",
            text: "FIXTURE_ONLY_MARKER لا يجوز فصل العامل.",
            sequence: 1,
            textOrigin: "FIXTURE",
          },
        ],
      },
    });

    const matterLinkedId = crypto.randomUUID();
    await insertDocument({
      id: matterLinkedId,
      title: "Matter leaked constitution",
      documentType: "CONSTITUTION",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      textOrigin: "SOURCE_TEXT",
      matterId: "matter-foreign",
      sourceUrl: "https://example.test/matter-linked-constitution",
    });
    await persistProvisionsAndChunks({
      documentId: matterLinkedId,
      sourceUrl: "https://example.test/matter-linked",
      parsed: {
        title: "Matter leaked constitution",
        documentType: "CONSTITUTION",
        issuingAuthority: "Egyptian Parliament",
        language: "ar",
        textOrigin: "SOURCE_TEXT",
        authorityStatus: "AUTHORITATIVE_SOURCE",
        normalizedText: "MATTER_LINKED_MARKER",
        provisions: [
          {
            provisionType: "ARTICLE",
            provisionNumber: "25",
            heading: "مادة (25)",
            text: "MATTER_LINKED_MARKER",
            sequence: 1,
            textOrigin: "SOURCE_TEXT",
          },
        ],
      },
    });

    const userId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const matterId = crypto.randomUUID();
    await db.insert(user).values({
      id: userId,
      name: "Retrieval Tester",
      email: "retrieval-isolation@example.com",
      emailVerified: true,
      firstName: "Retrieval",
      lastName: "Tester",
      role: "LAWYER",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Retrieval isolation workspace",
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(matters).values({
      id: matterId,
      workspaceId,
      title: "Retrieval isolation matter",
      status: "OPEN",
      matterType: "OTHER",
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      workspaceId,
      matterId,
      uploadedBy: userId,
      filename: "secret.txt",
      originalFilename: "secret.txt",
      mimeType: "text/plain",
      fileSize: 32,
      storageLocation: "test/secret.txt",
      processingStatus: "PROCESSED",
      extractedText: "MATTER_ONLY_SECRET_PHRASE about Article 25",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const indexed = await syncLegalRetrievalIndex(constitutionId);
    expect(indexed.chunks).toBeGreaterThanOrEqual(3);
    expect(indexed.embedded).toBe(indexed.chunks);

    const storedArticle = await db
      .select()
      .from(legalProvisions)
      .where(eq(legalProvisions.legalDocumentId, constitutionId));
    const article25 = storedArticle.find(
      (row) => row.provisionType === "ARTICLE" && row.provisionNumber === "25",
    );
    expect(article25?.text).toBe(ARABIC_ARTICLE_25);
    // Hierarchy tokens come from Arabic ordinals in headings (الثانى → part_2).
    expect(article25?.hierarchyPath).toBe("constitution.part_2.chapter_1.article_25");
    const part = storedArticle.find((row) => row.id === article25?.parentId);
    expect(part?.provisionType).toBe("CHAPTER");

    const again = await syncLegalRetrievalIndex(constitutionId);
    expect(again.embedded).toBe(0);
    expect(again.reused).toBe(again.chunks);

    await db
      .update(legalProvisions)
      .set({
        text: `${ARABIC_ARTICLE_25} إضافة لاحقة.`,
        updatedAt: new Date(),
      })
      .where(eq(legalProvisions.id, article25!.id));
    const changed = await syncLegalRetrievalIndex(constitutionId);
    expect(changed.embedded).toBe(1);
    await db
      .update(legalProvisions)
      .set({ text: ARABIC_ARTICLE_25, updatedAt: new Date() })
      .where(eq(legalProvisions.id, article25!.id));
    await syncLegalRetrievalIndex(constitutionId);

    const exact = await searchLegalCorpus({
      query: "What does Article 25 of the Egyptian Constitution say?",
      filters: { legalDocumentId: constitutionId },
    });
    expect(exact.evidence[0]?.provisionNumber).toBe("25");
    expect(exact.evidence[0]?.text).toBe(ARABIC_ARTICLE_25);
    expect(exact.evidence.every((item) => item.text.includes("FIXTURE_ONLY_MARKER"))).toBe(
      false,
    );
    expect(exact.evidence.every((item) => item.text.includes("MATTER_LINKED_MARKER"))).toBe(
      false,
    );

    const education = await searchLegalCorpus({
      query: "What does the Egyptian Constitution say about education?",
      filters: { legalDocumentId: constitutionId },
    });
    expect(education.evidence[0]?.provisionNumber).toBe("19");
    expect(education.evidence[0]?.text).toContain("التعليم");

    const equality = await searchLegalCorpus({
      query: "Find the constitutional provision concerning equality.",
      filters: { legalDocumentId: constitutionId },
    });
    expect(equality.evidence[0]?.provisionNumber).toBe("53");

    const missingLaw = await askLegalQuestion({
      query: "What does Article 25 of Law 12 of 2003 say?",
    });
    expect(missingLaw.evidenceSufficient).toBe(false);
    expect(missingLaw.citations).toEqual([]);
    expect(missingLaw.answer).toContain("Law No. 12 of 2003");
    expect(missingLaw.answer).not.toContain("FIXTURE_ONLY_MARKER");
    expect(missingLaw.answer).not.toContain(ARABIC_ARTICLE_25);

    const secret = await searchLegalCorpus({
      query: "MATTER_ONLY_SECRET_PHRASE",
    });
    expect(secret.evidence).toEqual([]);
    expect(secret.evidenceSufficient).toBe(false);

    const answer = await askLegalQuestion({
      query: "What does Article 25 of the Egyptian Constitution say?",
      filters: { legalDocumentId: constitutionId },
    });
    expect(answer.evidenceSufficient).toBe(true);
    expect(answer.answer).toContain(ARABIC_ARTICLE_25);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations[0]).toMatchObject({
      legalProvisionId: article25!.id,
      provisionLabel: "Article 25",
      sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
    });
    expect(answer.citations.every((citation) => citation.legalDocumentId === constitutionId)).toBe(
      true,
    );
    expect(answer.answer).not.toContain("FIXTURE_ONLY_MARKER");
  });

  it("returns exact constitutional articles for explicit EN/AR references and ranges", async () => {
    resetTestState();
    process.env.LEGAL_EMBEDDING_PROVIDER = "mock";
    process.env.LLM_PROVIDER = "mock";
    process.env.WEB_SEARCH_PROVIDER = "mock";
    resetEnvCacheForTests();
    await cleanupRetrievalFixtures();
    await insertSource();

    const constitutionId = crypto.randomUUID();
    await insertDocument({
      id: constitutionId,
      title: "دستور جمهورية مصر العربية",
      documentType: "CONSTITUTION",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      textOrigin: "SOURCE_TEXT",
    });
    await persistProvisionsAndChunks({
      documentId: constitutionId,
      sourceUrl: "https://parliament.gov.eg/Constitution.aspx",
      parsed: constitutionParsed(),
    });
    await syncLegalRetrievalIndex(constitutionId);

    const filters = { legalDocumentId: constitutionId };

    const article1 = await searchLegalCorpus({
      query: "What is Article 1 of the Egyptian Constitution?",
      filters,
    });
    expect(article1.evidence.map((item) => item.provisionNumber)).toEqual(["1"]);
    expect(article1.evidence[0]?.text).toBe(ARABIC_ARTICLE_1);
    expect(article1.evidence[0]?.title).toBe("دستور جمهورية مصر العربية");

    const article1Ar = await searchLegalCorpus({
      query: "ما هي المادة الأولى من الدستور المصري؟",
      filters,
    });
    expect(article1Ar.evidence.map((item) => item.provisionNumber)).toEqual(["1"]);
    expect(article1Ar.evidence[0]?.text).toBe(ARABIC_ARTICLE_1);

    const article2 = await searchLegalCorpus({
      query: "What is Article 2?",
      filters,
    });
    expect(article2.evidence.map((item) => item.provisionNumber)).toEqual(["2"]);
    expect(article2.evidence[0]?.text).toBe(ARABIC_ARTICLE_2);

    const article2Ar = await searchLegalCorpus({
      query: "ما هي المادة الثانية؟",
      filters,
    });
    expect(article2Ar.evidence.map((item) => item.provisionNumber)).toEqual(["2"]);

    const article227 = await searchLegalCorpus({
      query: "What is Article 227?",
      filters,
    });
    expect(article227.evidence.map((item) => item.provisionNumber)).toEqual(["227"]);
    expect(article227.evidence[0]?.text).toBe(ARABIC_ARTICLE_227);

    const rangeEn = await searchLegalCorpus({
      query: "Show me Articles 1 through 5.",
      filters,
    });
    expect(rangeEn.evidence.map((item) => item.provisionNumber)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);

    const rangeAr = await searchLegalCorpus({
      query: "ما هي المواد من 1 إلى 5؟",
      filters,
    });
    expect(rangeAr.evidence.map((item) => item.provisionNumber)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);

    const conceptual = await searchLegalCorpus({
      query: "What constitutional provisions discuss the identity of the Egyptian state?",
      filters,
      debug: true,
    });
    expect(conceptual.debug?.detectedReferences.hasExplicitArticleReference).toBe(false);
    expect(conceptual.debug?.ranking.formula).not.toContain("exact article lookup");
    // Conceptual questions must not force a lone Article 1 exact lookup.
    expect(conceptual.evidence.map((item) => item.provisionNumber)).not.toEqual(["1"]);

    const answered = await askLegalQuestion({
      query: "What is Article 1 of the Egyptian Constitution?",
      filters,
    });
    expect(answered.evidenceSufficient).toBe(true);
    expect(answered.answer).toContain("Article 1");
    expect(answered.answer).toContain(ARABIC_ARTICLE_1);
    expect(answered.answer).not.toContain("Article 227");
    expect(answered.citations[0]?.provisionLabel).toBe("Article 1");
  });
});
