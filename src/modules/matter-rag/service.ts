export { chunkPageText } from "@/modules/matter-rag/chunk";
export {
  indexMatterDocument,
  indexMatterDocumentsForMatter,
} from "@/modules/matter-rag/index-document";
export {
  matterHitsToEvidence,
  searchMatterDocumentsHybrid,
  type MatterRagHit,
} from "@/modules/matter-rag/search";

import {
  matterHitsToEvidence,
  searchMatterDocumentsHybrid,
} from "@/modules/matter-rag/search";
import type { AuthContext } from "@/modules/authorization/permissions";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";

/**
 * Matter Document Retrieval Service — hybrid Matter RAG with page provenance.
 */
export class MatterDocumentRetrievalService {
  async search(input: {
    query: string;
    matterId: string;
    workspaceId: string;
    auth: AuthContext;
    limit?: number;
    documentId?: string;
  }): Promise<{ hits: Awaited<ReturnType<typeof searchMatterDocumentsHybrid>>; evidence: LegalEvidence[] }> {
    const hits = await searchMatterDocumentsHybrid(input);
    return {
      hits,
      evidence: matterHitsToEvidence(hits, input.matterId),
    };
  }
}

export function getMatterDocumentRetrievalService() {
  return new MatterDocumentRetrievalService();
}
