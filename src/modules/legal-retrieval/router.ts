import { LegalCorpusRetrievalSource } from "@/modules/legal-retrieval/sources/legal-corpus";
import { WebResearchRetrievalSource } from "@/modules/legal-retrieval/sources/web-research";
import type {
  LegalEvidence,
  RetrievalSource,
  RetrievalSourceKind,
  RetrievalSourceQuery,
} from "@/modules/legal-retrieval/types";

/**
 * Routes a lawyer question to independent retrieval namespaces.
 */
export class RetrievalRouter {
  constructor(private readonly sources: RetrievalSource[]) {}

  kinds(): RetrievalSourceKind[] {
    return this.sources.map((source) => source.kind);
  }

  source(kind: RetrievalSourceKind): RetrievalSource | undefined {
    return this.sources.find((source) => source.kind === kind);
  }

  async search(
    input: RetrievalSourceQuery & { kinds?: RetrievalSourceKind[] },
  ): Promise<LegalEvidence[]> {
    const allowed = new Set(input.kinds ?? this.kinds());
    const selected = this.sources.filter((source) => allowed.has(source.kind));
    const groups = await Promise.all(selected.map((source) => source.search(input)));
    return groups.flat().sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId));
  }
}

export function createLegalRetrievalRouter(options?: {
  includeWeb?: boolean;
}): RetrievalRouter {
  const sources: RetrievalSource[] = [new LegalCorpusRetrievalSource()];
  if (options?.includeWeb !== false) {
    sources.push(new WebResearchRetrievalSource());
  }
  return new RetrievalRouter(sources);
}
