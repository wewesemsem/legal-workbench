import type { LegalDocumentType } from "@/modules/legal-corpus/types";
import type { DetectedLegalReferences } from "@/modules/legal-retrieval/references";

export type RetrievalSourceKind = "LEGAL_CORPUS" | "MATTER_DOCUMENT" | "WEB_RESEARCH";

export type ResearchSourceMode = "CORPUS" | "WEB" | "BOTH";

export type WebAuthorityStatus =
  | "PRIMARY_OFFICIAL"
  | "OFFICIAL_GOVERNMENT"
  | "OFFICIAL_COURT"
  | "OFFICIAL_PARLIAMENT"
  | "SECONDARY_LEGAL"
  | "ACADEMIC"
  | "GENERAL_WEB"
  | "SEARCH_RESULT";

export type WebSourceStatus = "FETCHED" | "UNFETCHED" | "ACCESS_RESTRICTED" | "ERROR";

export type CitationKind = "LEGAL_CORPUS" | "WEB" | "MATTER_DOCUMENT";

export type LegalSearchFilters = {
  country?: string;
  jurisdiction?: string;
  language?: string;
  documentType?: LegalDocumentType;
  authorityStatus?: "AUTHORITATIVE_SOURCE";
  contentType?: "SOURCE_TEXT" | "OCR";
  legalDocumentId?: string;
};

export type ResolvedLegalFilters = {
  country: string;
  jurisdiction?: string;
  language?: string;
  documentType?: LegalDocumentType;
  authorityStatus: "AUTHORITATIVE_SOURCE";
  reviewStatus: "APPROVED";
  contentType?: "SOURCE_TEXT" | "OCR";
  legalDocumentId?: string;
  documentNumber?: string;
  year?: number;
};

export type LegalEvidence = {
  sourceKind: RetrievalSourceKind;
  chunkId: string;
  documentId: string;
  provisionId: string;
  title: string;
  heading: string | null;
  provisionType: string | null;
  provisionNumber: string | null;
  text: string;
  score: number;
  sourceUrl: string | null;
  authorityStatus: string;
  language: string;
  hierarchyPath: string | null;
  documentType: string;
  country: string;
  jurisdiction: string;
  issuingAuthority: string;
  date: string | null;
  /** Web / unified evidence fields (null for pure corpus hits). */
  domain?: string | null;
  sourceName?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
  webAuthority?: WebAuthorityStatus | null;
  sourceStatus?: WebSourceStatus | null;
  contentHash?: string | null;
  canonicalUrl?: string | null;
};

export type LegalCitation = {
  citationKind: CitationKind;
  legalDocumentId: string;
  legalProvisionId: string;
  legalChunkId: string;
  sourceUrl: string | null;
  retrievalScore: number;
  documentTitle: string;
  provisionLabel: string;
  sourceName: string;
  marker: string;
  domain?: string | null;
  webAuthority?: WebAuthorityStatus | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
  excerpt?: string | null;
};

export type ResearchSourceRecord = {
  url: string;
  title: string;
  domain: string;
  sourceType: "WEB";
  authorityStatus: WebAuthorityStatus;
  sourceStatus: WebSourceStatus;
  publishedAt: string | null;
  retrievedAt: string | null;
  relevanceScore: number;
  excerpt: string | null;
};

export type RankingBoostBreakdown = {
  exactReference: number;
  documentMatch: number;
  subjectTerm: number;
  phrase: number;
  titleMatch: number;
  hierarchyMatch: number;
  total: number;
};

export type RetrievalDebugHit = {
  chunkId: string;
  provisionNumber: string | null;
  hierarchyPath: string | null;
  title: string;
  /** Raw keyword / ts_rank score before list normalization. */
  rawKeywordScore: number;
  /** Raw vector similarity before list normalization. */
  rawVectorScore: number;
  /** Normalized keyword contribution (0–1 within the keyword candidate list). */
  keywordScore: number;
  /** Normalized vector contribution (0–1 within the vector candidate list). */
  vectorScore: number;
  boost: number;
  boostBreakdown: RankingBoostBreakdown;
  /** Final hybrid score after weights and boosts. */
  score: number;
};

export type RetrievalDebugTrace = {
  query: string;
  expandedTerms: string[];
  detectedReferences: DetectedLegalReferences;
  ranking: {
    keywordWeight: number;
    vectorWeight: number;
    formula: string;
  };
  keywordResults: RetrievalDebugHit[];
  vectorResults: RetrievalDebugHit[];
  mergedResults: RetrievalDebugHit[];
  evidence: RetrievalDebugHit[];
};

export type LegalSearchResult = {
  evidence: LegalEvidence[];
  evidenceSufficient: boolean;
  limitation: { code: string; message: string } | null;
  debug?: RetrievalDebugTrace;
};

export type LegalAnswer = {
  answer: string;
  citations: LegalCitation[];
  evidenceSufficient: boolean;
  limitation: string | null;
  debug?: RetrievalDebugTrace;
};

export type ResearchAnswer = LegalAnswer & {
  evidence: LegalEvidence[];
  researchSources: ResearchSourceRecord[];
  sourceMode: ResearchSourceMode;
  researchRunId: string | null;
  metadata: {
    corpusEvidenceCount: number;
    webEvidenceCount: number;
    webDiscoveryCount: number;
    corpusLimitation: string | null;
  };
};

export type RetrievalSourceQuery = {
  query: string;
  filters?: LegalSearchFilters;
  limit?: number;
  debug?: boolean;
  matterId?: string;
};

export interface RetrievalSource {
  readonly kind: RetrievalSourceKind;
  search(input: RetrievalSourceQuery): Promise<LegalEvidence[]>;
}
