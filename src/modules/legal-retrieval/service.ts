import {
  lexicalSearchVariants,
  normalizeArabicForSearch,
} from "@/modules/legal-retrieval/arabic-normalize";
import { getLegalEmbeddingConfig, getLegalRetrievalConfig } from "@/modules/legal-retrieval/config";
import { getLegalEmbeddingService } from "@/modules/legal-retrieval/embedding-service";
import { resolveLegalFilters } from "@/modules/legal-retrieval/filters";
import { combineHybridScores } from "@/modules/legal-retrieval/hybrid-rank";
import { expandLegalQuery } from "@/modules/legal-retrieval/query-expansion";
import { computeBoostBreakdown } from "@/modules/legal-retrieval/ranking";
import {
  detectLegalReferences,
  missingInstrumentMessage,
  type DetectedLegalReferences,
} from "@/modules/legal-retrieval/references";
import {
  exactArticleChunks,
  findAuthoritativeInstrument,
  keywordSearchChunks,
  toVectorLiteral,
  vectorSearchChunks,
  type RetrievedChunkRow,
} from "@/modules/legal-retrieval/repository";
import type {
  LegalEvidence,
  LegalSearchFilters,
  LegalSearchResult,
  RankingBoostBreakdown,
  ResolvedLegalFilters,
  RetrievalDebugHit,
  RetrievalDebugTrace,
} from "@/modules/legal-retrieval/types";

const STOPWORDS = new Set([
  "what",
  "does",
  "the",
  "of",
  "a",
  "an",
  "say",
  "says",
  "about",
  "how",
  "is",
  "in",
  "to",
  "for",
  "and",
  "or",
  "please",
  "find",
  "concerning",
  "egyptian",
  "do",
  "did",
  "on",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "currently",
  "between",
  "under",
]);

const EMPTY_BOOST: RankingBoostBreakdown = {
  exactReference: 0,
  documentMatch: 0,
  subjectTerm: 0,
  phrase: 0,
  titleMatch: 0,
  hierarchyMatch: 0,
  total: 0,
};

export function significantSearchTokens(text: string): string[] {
  const tokens = text.toLowerCase().match(/\p{L}[\p{L}\p{N}]{1,}/gu) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.length < 2 || STOPWORDS.has(token) || seen.has(token)) {
      continue;
    }
    seen.add(token);
    unique.push(token);
    if (unique.length >= 24) {
      break;
    }
  }
  return unique;
}

function asNumber(value: number | string | null | undefined): number {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function evidenceFromRow(row: RetrievedChunkRow, score: number): LegalEvidence {
  return {
    sourceKind: "LEGAL_CORPUS",
    chunkId: row.chunk_id,
    documentId: row.legal_document_id,
    provisionId: row.provision_id,
    title: row.document_title,
    heading: row.heading,
    provisionType: row.provision_type,
    provisionNumber: row.provision_number,
    text: row.source_text,
    score,
    sourceUrl: row.source_url,
    authorityStatus: row.authority_status,
    language: row.language,
    hierarchyPath: row.hierarchy_path,
    documentType: row.document_type,
    country: row.country,
    jurisdiction: row.jurisdiction,
    issuingAuthority: row.issuing_authority,
    date: null,
  };
}

function articleNumberOf(row: RetrievedChunkRow): string | null {
  if (row.provision_type === "ARTICLE" && row.provision_number) {
    return row.provision_number;
  }
  return row.article_number;
}

/** Keep exact hits in the order the user requested (e.g. Articles 1–5). */
function sortExactRows(
  rows: RetrievedChunkRow[],
  articleNumbers: string[],
): RetrievedChunkRow[] {
  const order = new Map(articleNumbers.map((number, index) => [number, index]));
  return [...rows].sort((left, right) => {
    const leftNumber = articleNumberOf(left) ?? "";
    const rightNumber = articleNumberOf(right) ?? "";
    const leftOrder = order.get(leftNumber) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(rightNumber) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.chunk_id.localeCompare(right.chunk_id);
  });
}

function debugHit(
  row: RetrievedChunkRow | undefined,
  id: string,
  scores: {
    rawKeywordScore: number;
    rawVectorScore: number;
    keywordScore: number;
    vectorScore: number;
    boost: number;
    boostBreakdown: RankingBoostBreakdown;
    score: number;
  },
): RetrievalDebugHit {
  return {
    chunkId: id,
    provisionNumber: row?.provision_number ?? null,
    hierarchyPath: row?.hierarchy_path ?? null,
    title: row?.document_title ?? "",
    rawKeywordScore: scores.rawKeywordScore,
    rawVectorScore: scores.rawVectorScore,
    keywordScore: scores.keywordScore,
    vectorScore: scores.vectorScore,
    boost: scores.boost,
    boostBreakdown: scores.boostBreakdown,
    score: scores.score,
  };
}

function subjectTerms(addedTerms: string[], documentType?: string): string[] {
  return addedTerms.filter((term) => {
    if (documentType === "CONSTITUTION" && (term === "الدستور" || term === "دستور")) {
      return false;
    }
    return true;
  });
}

function lexicalQueryText(text: string, documentType?: string): string {
  if (documentType !== "CONSTITUTION") {
    return text;
  }
  return text
    .replace(/\bconstitutions?\b/gi, " ")
    .replace(/\bconstitutional\b/gi, " ")
    .replace(/الدستور/g, " ");
}

function buildTsQuery(tokens: string[]): string {
  const variants: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    for (const variant of lexicalSearchVariants(token)) {
      if (seen.has(variant)) {
        continue;
      }
      seen.add(variant);
      variants.push(variant);
    }
  }
  return variants.join(" OR ");
}

function emptyDebug(
  query: string,
  references: DetectedLegalReferences,
  expandedTerms: string[] = [],
): RetrievalDebugTrace {
  const config = getLegalRetrievalConfig();
  return {
    query,
    expandedTerms,
    detectedReferences: references,
    ranking: {
      keywordWeight: config.keywordWeight,
      vectorWeight: config.vectorWeight,
      formula:
        "hybrid = keywordWeight * normalizedKeyword + vectorWeight * normalizedVector + boost",
    },
    keywordResults: [],
    vectorResults: [],
    mergedResults: [],
    evidence: [],
  };
}

function insufficient(
  message: string,
  code: string,
  debug?: RetrievalDebugTrace,
): LegalSearchResult {
  return {
    evidence: [],
    evidenceSufficient: false,
    limitation: { code, message },
    debug,
  };
}

export async function searchLegalCorpus(input: {
  query: string;
  filters?: LegalSearchFilters;
  limit?: number;
  debug?: boolean;
  /**
   * Inferred article/provision numbers from intent resolution.
   * Merged with numbers detected in the query string so natural-language
   * asks can still hit the exact-article path.
   */
  articleNumbers?: string[];
  /** Optional document-type override from intent resolution. */
  documentType?: LegalSearchFilters["documentType"];
}): Promise<LegalSearchResult> {
  const query = input.query.trim();
  if (!query || query.length > 4_000) {
    return insufficient(
      "No sufficient indexed legal source found.",
      "INVALID_QUERY",
    );
  }

  const detected = detectLegalReferences(query);
  const overrideArticles = (input.articleNumbers ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  const articleNumbers = [...new Set([...detected.articleNumbers, ...overrideArticles])];
  const references = {
    ...detected,
    articleNumbers,
    hasExplicitArticleReference: articleNumbers.length > 0,
  };
  const config = getLegalRetrievalConfig();
  const limit = input.limit ?? config.topK;
  let filters: ResolvedLegalFilters = resolveLegalFilters({
    ...input.filters,
    documentType: input.documentType ?? input.filters?.documentType,
  });

  if (references.mentionsConstitution && !filters.documentType && references.laws.length === 0) {
    filters = { ...filters, documentType: "CONSTITUTION" };
  }

  const law = references.laws[0];
  if (law) {
    const year = Number(law.year);
    const present = await findAuthoritativeInstrument({
      documentNumber: law.number,
      year,
      filters,
    });
    if (!present) {
      return insufficient(
        missingInstrumentMessage(law, references.articleNumbers[0]),
        "INSTRUMENT_NOT_IN_CORPUS",
        input.debug ? emptyDebug(query, references) : undefined,
      );
    }
    filters = {
      ...filters,
      documentNumber: law.number,
      year,
      documentType: filters.documentType === "CONSTITUTION" ? undefined : filters.documentType,
    };
  }

  const expanded = expandLegalQuery(query);

  // Explicit / inferred legal references take priority over semantic similarity.
  // Do not let keyword/vector ranking replace a deterministic provision hit.
  if (references.hasExplicitArticleReference) {
    const exactLimit = Math.max(limit, references.articleNumbers.length);
    const exactRows = sortExactRows(
      await exactArticleChunks({
        articleNumbers: references.articleNumbers,
        filters,
        limit: exactLimit,
      }),
      references.articleNumbers,
    );
    if (exactRows.length) {
      const evidence = exactRows.slice(0, exactLimit).map((row) =>
        evidenceFromRow(row, config.exactReferenceBoost + 1),
      );
      console.error("[legal-retrieval] search", {
        queryChars: query.length,
        results: evidence.length,
        mode: "exact_article",
        country: filters.country,
        documentType: filters.documentType ?? null,
        articles: references.articleNumbers,
      });
      const exactBoost: RankingBoostBreakdown = {
        ...EMPTY_BOOST,
        exactReference: config.exactReferenceBoost,
        total: config.exactReferenceBoost,
      };
      return {
        evidence,
        evidenceSufficient: true,
        limitation: null,
        debug: input.debug
          ? {
              query,
              expandedTerms: expanded.addedTerms,
              detectedReferences: references,
              ranking: {
                keywordWeight: config.keywordWeight,
                vectorWeight: config.vectorWeight,
                formula: "exact article lookup (document + article_number)",
              },
              keywordResults: [],
              vectorResults: [],
              mergedResults: evidence.map((item) =>
                debugHit(
                  exactRows.find((row) => row.chunk_id === item.chunkId),
                  item.chunkId,
                  {
                    rawKeywordScore: 1,
                    rawVectorScore: 0,
                    keywordScore: 1,
                    vectorScore: 0,
                    boost: exactBoost.total,
                    boostBreakdown: exactBoost,
                    score: item.score,
                  },
                ),
              ),
              evidence: evidence.map((item) =>
                debugHit(
                  exactRows.find((row) => row.chunk_id === item.chunkId),
                  item.chunkId,
                  {
                    rawKeywordScore: 1,
                    rawVectorScore: 0,
                    keywordScore: 1,
                    vectorScore: 0,
                    boost: exactBoost.total,
                    boostBreakdown: exactBoost,
                    score: item.score,
                  },
                ),
              ),
            }
          : undefined,
      };
    }

    const requestedArticle = references.articleNumbers.join(", ");
    const message = `Article ${requestedArticle} was not found in the indexed legal corpus, so I can't quote it from the available primary sources.`;
    return insufficient(
      message,
      "ARTICLE_NOT_IN_CORPUS",
      input.debug
        ? emptyDebug(query, references, expanded.addedTerms)
        : undefined,
    );
  }

  const subjects = subjectTerms(expanded.addedTerms, filters.documentType);
  const tokens = significantSearchTokens(
    lexicalQueryText(expanded.lexicalText, filters.documentType),
  );
  const tsQuery = buildTsQuery(tokens);
  const candidateLimit = Math.min(Math.max(limit * 3, limit), 50);

  const keywordRows = tsQuery
    ? await keywordSearchChunks({ tsQuery, filters, limit: candidateLimit })
    : [];

  let vectorRows: RetrievedChunkRow[] = [];
  try {
    const embedded = await getLegalEmbeddingService().embedTexts([expanded.embedText]);
    const vector = embedded.vectors[0];
    if (vector) {
      vectorRows = await vectorSearchChunks({
        vectorLiteral: toVectorLiteral(vector),
        filters,
        limit: candidateLimit,
        minSimilarity: config.vectorMinSimilarity,
      });
    }
  } catch (error) {
    console.error("[legal-retrieval] vector search skipped", {
      message: error instanceof Error ? error.message : "unknown",
      model: getLegalEmbeddingConfig().model,
    });
  }

  if (subjects.length) {
    const focused = vectorRows.filter((row) =>
      subjects.some(
        (term) =>
          row.source_text.includes(term) ||
          normalizeArabicForSearch(row.source_text).includes(normalizeArabicForSearch(term)),
      ),
    );
    if (focused.length) {
      vectorRows = focused;
    }
  }

  const rowById = new Map<string, RetrievedChunkRow>();
  for (const row of [...keywordRows, ...vectorRows]) {
    rowById.set(row.chunk_id, row);
  }

  const rawKeywordScores = new Map<string, number>();
  for (const row of keywordRows) {
    rawKeywordScores.set(row.chunk_id, asNumber(row.score));
  }

  const rawVectorScores = new Map<string, number>();
  for (const row of vectorRows) {
    rawVectorScores.set(row.chunk_id, asNumber(row.score));
  }

  const boostBreakdowns = new Map<string, RankingBoostBreakdown>();
  const boosts = new Map<string, number>();
  const boostOptions = {
    applyDocumentBoost: filters.documentType !== "CONSTITUTION",
    subjectTerms: subjects,
  };
  for (const row of rowById.values()) {
    const breakdown = computeBoostBreakdown(row, references, query, boostOptions);
    boostBreakdowns.set(row.chunk_id, breakdown);
    boosts.set(row.chunk_id, breakdown.total);
  }

  const ranked = combineHybridScores({
    keyword: [...rawKeywordScores.entries()].map(([id, score]) => ({ id, score })),
    vector: vectorRows.map((row) => ({ id: row.chunk_id, score: asNumber(row.score) })),
    keywordWeight: config.keywordWeight,
    vectorWeight: config.vectorWeight,
    boosts,
  });

  const rankingMeta = {
    keywordWeight: config.keywordWeight,
    vectorWeight: config.vectorWeight,
    formula:
      "hybrid = keywordWeight * normalizedKeyword + vectorWeight * normalizedVector + boost",
  };

  const keywordDebug = keywordRows.map((row) =>
    debugHit(row, row.chunk_id, {
      rawKeywordScore: asNumber(row.score),
      rawVectorScore: rawVectorScores.get(row.chunk_id) ?? 0,
      keywordScore: asNumber(row.score),
      vectorScore: 0,
      boost: boosts.get(row.chunk_id) ?? 0,
      boostBreakdown: boostBreakdowns.get(row.chunk_id) ?? EMPTY_BOOST,
      score: asNumber(row.score),
    }),
  );
  const vectorDebug = vectorRows.map((row) =>
    debugHit(row, row.chunk_id, {
      rawKeywordScore: rawKeywordScores.get(row.chunk_id) ?? 0,
      rawVectorScore: asNumber(row.score),
      keywordScore: 0,
      vectorScore: asNumber(row.score),
      boost: boosts.get(row.chunk_id) ?? 0,
      boostBreakdown: boostBreakdowns.get(row.chunk_id) ?? EMPTY_BOOST,
      score: asNumber(row.score),
    }),
  );
  const mergedDebug = ranked.map((hit) =>
    debugHit(rowById.get(hit.id), hit.id, {
      rawKeywordScore: rawKeywordScores.get(hit.id) ?? 0,
      rawVectorScore: rawVectorScores.get(hit.id) ?? 0,
      keywordScore: hit.keywordScore,
      vectorScore: hit.vectorScore,
      boost: hit.boost,
      boostBreakdown: boostBreakdowns.get(hit.id) ?? EMPTY_BOOST,
      score: hit.hybridScore,
    }),
  );

  const lexicalEvidence = keywordRows.length > 0;
  const bestVector = vectorRows.reduce(
    (best, row) => Math.max(best, asNumber(row.score)),
    0,
  );
  const vectorEvidence = bestVector >= config.evidenceMinScore;
  if (!lexicalEvidence && !vectorEvidence) {
    return insufficient(
      "No sufficient indexed legal source found.",
      "INSUFFICIENT_EVIDENCE",
      input.debug
        ? {
            ...emptyDebug(query, references, expanded.addedTerms),
            keywordResults: keywordDebug,
            vectorResults: vectorDebug,
            mergedResults: mergedDebug,
          }
        : undefined,
    );
  }

  const selected = ranked.slice(0, limit);
  const evidence = selected
    .map((hit) => {
      const row = rowById.get(hit.id);
      return row ? evidenceFromRow(row, hit.hybridScore) : null;
    })
    .filter((item): item is LegalEvidence => item !== null);

  if (!evidence.length) {
    return insufficient("No sufficient indexed legal source found.", "INSUFFICIENT_EVIDENCE");
  }

  console.error("[legal-retrieval] search", {
    queryChars: query.length,
    results: evidence.length,
    mode: "hybrid_semantic",
    country: filters.country,
    documentType: filters.documentType ?? null,
  });

  const debug: RetrievalDebugTrace | undefined = input.debug
    ? {
        query,
        expandedTerms: expanded.addedTerms,
        detectedReferences: references,
        ranking: rankingMeta,
        keywordResults: keywordDebug,
        vectorResults: vectorDebug,
        mergedResults: mergedDebug,
        evidence: selected.map((hit) =>
          debugHit(rowById.get(hit.id), hit.id, {
            rawKeywordScore: rawKeywordScores.get(hit.id) ?? 0,
            rawVectorScore: rawVectorScores.get(hit.id) ?? 0,
            keywordScore: hit.keywordScore,
            vectorScore: hit.vectorScore,
            boost: hit.boost,
            boostBreakdown: boostBreakdowns.get(hit.id) ?? EMPTY_BOOST,
            score: hit.hybridScore,
          }),
        ),
      }
    : undefined;

  return {
    evidence,
    evidenceSufficient: true,
    limitation: null,
    debug,
  };
}
