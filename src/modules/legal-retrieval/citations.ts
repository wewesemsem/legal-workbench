import type {
  CitationKind,
  LegalCitation,
  LegalEvidence,
} from "@/modules/legal-retrieval/types";

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function provisionLabel(
  evidence: Pick<LegalEvidence, "provisionType" | "provisionNumber" | "heading" | "sourceKind" | "title">,
): string {
  if (evidence.sourceKind === "WEB_RESEARCH") {
    return evidence.title || "Web source";
  }
  if (evidence.provisionType === "ARTICLE" && evidence.provisionNumber) {
    return `Article ${evidence.provisionNumber}`;
  }
  if (evidence.provisionNumber) {
    return `${evidence.provisionType ?? "Provision"} ${evidence.provisionNumber}`;
  }
  return evidence.heading?.trim() || "Provision";
}

function citationKindFor(evidence: LegalEvidence): CitationKind {
  if (evidence.sourceKind === "WEB_RESEARCH") {
    return "WEB";
  }
  if (evidence.sourceKind === "MATTER_DOCUMENT") {
    return "MATTER_DOCUMENT";
  }
  return "LEGAL_CORPUS";
}

export function citationFromEvidence(evidence: LegalEvidence, marker: string): LegalCitation {
  return {
    citationKind: citationKindFor(evidence),
    legalDocumentId: evidence.documentId,
    legalProvisionId: evidence.provisionId,
    legalChunkId: evidence.chunkId,
    sourceUrl: safeHttpUrl(evidence.sourceUrl),
    retrievalScore: evidence.score,
    documentTitle: evidence.title,
    provisionLabel: provisionLabel(evidence),
    sourceName: evidence.sourceName ?? evidence.issuingAuthority,
    marker,
    domain: evidence.domain ?? null,
    webAuthority: evidence.webAuthority ?? null,
    publishedAt: evidence.publishedAt ?? evidence.date ?? null,
    retrievedAt: evidence.retrievedAt ?? null,
    excerpt: evidence.sourceKind === "WEB_RESEARCH" ? evidence.text.slice(0, 280) : null,
  };
}

export function citationsForMarkers(
  markers: string[],
  evidence: LegalEvidence[],
): LegalCitation[] {
  const citations: LegalCitation[] = [];
  const seen = new Set<string>();
  for (const marker of markers) {
    const match = /^S(\d+)$/.exec(marker.trim());
    if (!match) {
      continue;
    }
    const index = Number(match[1]) - 1;
    const item = evidence[index];
    if (!item || seen.has(item.chunkId)) {
      continue;
    }
    seen.add(item.chunkId);
    citations.push(citationFromEvidence(item, `S${index + 1}`));
  }
  return citations;
}

const LATIN_ARTICLE = /\bArticle\s+([0-9]+)/gi;

export function unsupportedArticleNumbers(
  answer: string,
  evidence: LegalEvidence[],
): string[] {
  const allowed = new Set(
    evidence
      .map((item) => item.provisionNumber)
      .filter((value): value is string => Boolean(value)),
  );
  const unsupported = new Set<string>();
  for (const match of answer.matchAll(LATIN_ARTICLE)) {
    const number = match[1] ?? "";
    if (number && !allowed.has(number)) {
      unsupported.add(number);
    }
  }
  return [...unsupported];
}

export type ParsedModelAnswer = {
  answer: string;
  markers: string[];
};

export function parseModelAnswer(content: string): ParsedModelAnswer {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(fenced.slice(start, end + 1)) as {
        answer?: unknown;
        citations?: unknown;
      };
      if (typeof parsed.answer === "string") {
        const markers = Array.isArray(parsed.citations)
          ? parsed.citations.filter((item): item is string => typeof item === "string")
          : [];
        return { answer: parsed.answer.trim(), markers };
      }
    } catch {
      // Fall through to marker extraction.
    }
  }

  const markers = [...content.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]!);
  return { answer: content.trim(), markers: [...new Set(markers)] };
}
