import { searchLegalCorpus } from "@/modules/legal-retrieval/service";
import type {
  LegalEvidence,
  RetrievalSource,
  RetrievalSourceQuery,
} from "@/modules/legal-retrieval/types";

export class LegalCorpusRetrievalSource implements RetrievalSource {
  readonly kind = "LEGAL_CORPUS" as const;

  async search(input: RetrievalSourceQuery): Promise<LegalEvidence[]> {
    const result = await searchLegalCorpus(input);
    return result.evidence;
  }
}
