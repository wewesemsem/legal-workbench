import { getLegalRetrievalConfig } from "@/modules/legal-retrieval/config";
import type { DetectedLegalReferences } from "@/modules/legal-retrieval/references";
import type { RetrievedChunkRow } from "@/modules/legal-retrieval/repository";
import type { RankingBoostBreakdown } from "@/modules/legal-retrieval/types";
import { normalizeArabicForSearch } from "@/modules/legal-retrieval/arabic-normalize";

function textContains(haystack: string, needle: string): boolean {
  if (!needle) {
    return false;
  }
  if (haystack.includes(needle)) {
    return true;
  }
  return normalizeArabicForSearch(haystack).includes(normalizeArabicForSearch(needle));
}

export function computeBoostBreakdown(
  row: RetrievedChunkRow,
  references: DetectedLegalReferences,
  query: string,
  options: { applyDocumentBoost: boolean; subjectTerms: string[] },
): RankingBoostBreakdown {
  const config = getLegalRetrievalConfig();
  const breakdown: RankingBoostBreakdown = {
    exactReference: 0,
    documentMatch: 0,
    subjectTerm: 0,
    phrase: 0,
    titleMatch: 0,
    hierarchyMatch: 0,
    total: 0,
  };

  const articleNumber =
    row.provision_type === "ARTICLE" ? row.provision_number : row.article_number;
  if (articleNumber && references.articleNumbers.includes(articleNumber)) {
    breakdown.exactReference += config.exactReferenceBoost;
  }
  if (
    references.laws.some(
      (law) =>
        law.number === row.document_number && Number(law.year) === Number(row.year),
    )
  ) {
    breakdown.exactReference += config.exactReferenceBoost;
  }
  if (
    options.applyDocumentBoost &&
    references.mentionsConstitution &&
    row.document_type === "CONSTITUTION"
  ) {
    breakdown.documentMatch += config.documentMatchBoost;
  }
  if (options.subjectTerms.some((term) => textContains(row.source_text, term))) {
    breakdown.subjectTerm += 0.75;
  }
  const title = row.document_title?.trim();
  if (title && textContains(query, title)) {
    breakdown.titleMatch += config.documentMatchBoost;
  }
  if (
    references.phrases.some(
      (phrase) => phrase.length >= 3 && textContains(row.source_text, phrase),
    )
  ) {
    breakdown.phrase += config.phraseBoost;
  }
  if (row.hierarchy_path && query.includes(row.hierarchy_path)) {
    breakdown.hierarchyMatch += config.exactReferenceBoost;
  }

  breakdown.total =
    breakdown.exactReference +
    breakdown.documentMatch +
    breakdown.subjectTerm +
    breakdown.phrase +
    breakdown.titleMatch +
    breakdown.hierarchyMatch;
  return breakdown;
}
