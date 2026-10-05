import { detectLegalReferences } from "@/modules/legal-retrieval/references";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";

function articleNumberFor(item: LegalEvidence): string | null {
  return item.provisionNumber?.trim() || null;
}

/**
 * Order retrieved evidence for answering: score desc, with query-exact
 * article matches pinned first in the requested article order so semantic
 * distractors cannot lead the answer.
 */
export function orderEvidenceForAnswer(
  query: string,
  evidence: LegalEvidence[],
): LegalEvidence[] {
  if (evidence.length <= 1) {
    return [...evidence];
  }

  const scored = [...evidence].sort(
    (left, right) =>
      right.score - left.score || left.chunkId.localeCompare(right.chunkId),
  );

  const references = detectLegalReferences(query);
  if (!references.articleNumbers.length) {
    return scored;
  }

  const requestedOrder = new Map(
    references.articleNumbers.map((number, index) => [number, index]),
  );
  const matching = scored
    .filter((item) => {
      const number = articleNumberFor(item);
      return Boolean(number && requestedOrder.has(number));
    })
    .sort((left, right) => {
      const leftOrder =
        requestedOrder.get(articleNumberFor(left) ?? "") ?? Number.MAX_SAFE_INTEGER;
      const rightOrder =
        requestedOrder.get(articleNumberFor(right) ?? "") ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.chunkId.localeCompare(right.chunkId);
    });
  if (!matching.length) {
    return scored;
  }

  const matchIds = new Set(matching.map((item) => item.chunkId));
  return [...matching, ...scored.filter((item) => !matchIds.has(item.chunkId))];
}
