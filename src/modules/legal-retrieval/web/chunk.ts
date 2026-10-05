import type { LegalEvidence, WebAuthorityStatus, WebSourceStatus } from "@/modules/legal-retrieval/types";
import type { WebDocument } from "@/modules/legal-retrieval/web/types";

function queryTokens(query: string): string[] {
  const tokens = query.toLowerCase().match(/\p{L}[\p{L}\p{N}]{1,}/gu) ?? [];
  return [...new Set(tokens)].slice(0, 24);
}

function scorePassage(text: string, tokens: string[]): number {
  if (!tokens.length) {
    return 0.2;
  }
  const normalized = text.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (normalized.includes(token.toLowerCase())) {
      hits += 1;
    }
  }
  return hits / tokens.length;
}

export function chunkWebDocument(input: {
  document: WebDocument;
  query: string;
  authority: WebAuthorityStatus;
  maxChunks?: number;
}): LegalEvidence[] {
  const maxChunks = input.maxChunks ?? 2;
  const paragraphs = input.document.content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40);
  const tokens = queryTokens(input.query);
  const ranked = paragraphs
    .map((text, index) => ({
      text,
      index,
      score: scorePassage(text, tokens),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = (ranked.length ? ranked : [{ text: input.document.content.slice(0, 1200), index: 0, score: 0.2 }])
    .slice(0, maxChunks);

  return selected.map((item, position) => {
    const chunkId = `web:${input.document.checksum}:${position}`;
    return {
      sourceKind: "WEB_RESEARCH" as const,
      chunkId,
      documentId: `webdoc:${input.document.checksum}`,
      provisionId: `webpass:${input.document.checksum}:${item.index}`,
      title: input.document.title,
      heading: null,
      provisionType: null,
      provisionNumber: null,
      text: item.text,
      score: item.score,
      sourceUrl: input.document.url,
      authorityStatus: input.authority,
      language: input.document.language,
      hierarchyPath: null,
      documentType: "WEB",
      country: "EG",
      jurisdiction: "WEB",
      issuingAuthority: input.document.sourceName,
      date: input.document.publishedAt,
      domain: input.document.domain,
      sourceName: input.document.sourceName,
      publishedAt: input.document.publishedAt,
      retrievedAt: input.document.retrievedAt,
      webAuthority: input.authority,
      sourceStatus: "FETCHED" as WebSourceStatus,
      contentHash: input.document.checksum,
      canonicalUrl: input.document.canonicalUrl,
    };
  });
}

export function discoveryOnlyRecord(input: {
  url: string;
  title: string;
  domain: string;
  sourceName: string;
  authority: WebAuthorityStatus;
  publishedAt: string | null;
  retrievedAt: string;
  sourceStatus: WebSourceStatus;
  relevanceScore: number;
  excerpt: string | null;
}) {
  return {
    url: input.url,
    title: input.title,
    domain: input.domain,
    sourceType: "WEB" as const,
    authorityStatus: input.authority,
    sourceStatus: input.sourceStatus,
    publishedAt: input.publishedAt,
    retrievedAt: input.retrievedAt,
    relevanceScore: input.relevanceScore,
    excerpt: input.excerpt,
  };
}
