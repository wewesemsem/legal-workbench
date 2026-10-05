export type RawScore = {
  id: string;
  score: number;
};

export type HybridRank = {
  id: string;
  keywordScore: number;
  vectorScore: number;
  boost: number;
  hybridScore: number;
};

function normalize(items: RawScore[]): Map<string, number> {
  const max = items.reduce((highest, item) => Math.max(highest, item.score), 0);
  const scores = new Map<string, number>();
  for (const item of items) {
    const previous = scores.get(item.id) ?? 0;
    const normalized = max > 0 ? item.score / max : 0;
    scores.set(item.id, Math.max(previous, normalized));
  }
  return scores;
}

/**
 * Deterministic weighted merge. Ties break on score, then id.
 */
export function combineHybridScores(input: {
  keyword: RawScore[];
  vector: RawScore[];
  keywordWeight: number;
  vectorWeight: number;
  boosts?: Map<string, number>;
}): HybridRank[] {
  const keyword = normalize(input.keyword);
  const vector = normalize(input.vector);
  const ids = new Set<string>([...keyword.keys(), ...vector.keys()]);

  const ranked: HybridRank[] = [];
  for (const id of ids) {
    const keywordScore = keyword.get(id) ?? 0;
    const vectorScore = vector.get(id) ?? 0;
    const boost = input.boosts?.get(id) ?? 0;
    ranked.push({
      id,
      keywordScore,
      vectorScore,
      boost,
      hybridScore:
        input.keywordWeight * keywordScore + input.vectorWeight * vectorScore + boost,
    });
  }

  ranked.sort((left, right) => {
    if (right.hybridScore !== left.hybridScore) {
      return right.hybridScore - left.hybridScore;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return ranked;
}

export function canReuseEmbedding(input: {
  previousHash: string | null;
  nextHash: string;
  previousModel: string | null;
  nextModel: string;
  previousVersion: string | null;
  nextVersion: string;
  hasEmbedding: boolean;
}): boolean {
  return Boolean(
    input.hasEmbedding &&
      input.previousHash &&
      input.previousHash === input.nextHash &&
      input.previousModel === input.nextModel &&
      input.previousVersion === input.nextVersion,
  );
}
