import { getEnv } from "@/lib/env";
import type { WebAuthorityStatus } from "@/modules/legal-retrieval/types";

export function getLegalEmbeddingConfig() {
  const env = getEnv();
  const provider = env.LEGAL_EMBEDDING_PROVIDER;
  const model =
    env.LEGAL_EMBEDDING_MODEL ??
    (provider === "openai" ? "text-embedding-3-small" : "local-hash-v1");
  return {
    provider,
    model,
    dimensions: env.LEGAL_EMBEDDING_DIMENSIONS,
    version: env.LEGAL_EMBEDDING_VERSION,
  };
}

export function getLegalRetrievalConfig() {
  const env = getEnv();
  return {
    topK: env.LEGAL_RETRIEVAL_TOP_K,
    keywordWeight: env.LEGAL_KEYWORD_WEIGHT,
    vectorWeight: env.LEGAL_VECTOR_WEIGHT,
    exactReferenceBoost: env.LEGAL_EXACT_REFERENCE_BOOST,
    documentMatchBoost: env.LEGAL_DOCUMENT_MATCH_BOOST,
    phraseBoost: env.LEGAL_PHRASE_BOOST,
    evidenceMinScore: env.LEGAL_EVIDENCE_MIN_SCORE,
    vectorMinSimilarity: env.LEGAL_VECTOR_MIN_SIMILARITY,
    chunkMaxChars: env.LEGAL_CHUNK_MAX_CHARS,
  };
}

export function getWebResearchConfig() {
  const env = getEnv();
  const authorityWeights: Record<WebAuthorityStatus, number> = {
    PRIMARY_OFFICIAL: env.WEB_AUTHORITY_PRIMARY_OFFICIAL,
    OFFICIAL_COURT: env.WEB_AUTHORITY_OFFICIAL_COURT,
    OFFICIAL_GOVERNMENT: env.WEB_AUTHORITY_OFFICIAL_GOVERNMENT,
    OFFICIAL_PARLIAMENT: env.WEB_AUTHORITY_OFFICIAL_PARLIAMENT,
    SECONDARY_LEGAL: env.WEB_AUTHORITY_SECONDARY_LEGAL,
    ACADEMIC: env.WEB_AUTHORITY_ACADEMIC,
    GENERAL_WEB: env.WEB_AUTHORITY_GENERAL_WEB,
    SEARCH_RESULT: env.WEB_AUTHORITY_SEARCH_RESULT,
  };
  return {
    provider: env.WEB_SEARCH_PROVIDER,
    braveApiKey: env.BRAVE_SEARCH_API_KEY,
    maxResults: env.WEB_SEARCH_MAX_RESULTS,
    fetchCandidates: env.WEB_SEARCH_FETCH_CANDIDATES,
    fetchTimeoutMs: env.WEB_FETCH_TIMEOUT_MS,
    fetchMaxBytes: env.WEB_FETCH_MAX_BYTES,
    fetchMaxRedirects: env.WEB_FETCH_MAX_REDIRECTS,
    authorityWeights,
    userAgent:
      env.LEGAL_CORPUS_USER_AGENT ||
      "Mozilla/5.0 (compatible; LawyerWorkbenchResearchBot/0.1; +https://localhost; research)",
  };
}

export function webAuthorityScore(status: WebAuthorityStatus | null | undefined): number {
  if (!status) {
    return getWebResearchConfig().authorityWeights.GENERAL_WEB;
  }
  return getWebResearchConfig().authorityWeights[status];
}
