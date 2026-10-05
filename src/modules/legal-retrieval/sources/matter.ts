import { assertMatterAccess, type AuthContext } from "@/modules/authorization/permissions";
import { forbidden } from "@/modules/authorization/errors";
import type {
  LegalEvidence,
  RetrievalSource,
  RetrievalSourceQuery,
} from "@/modules/legal-retrieval/types";
import {
  matterHitsToEvidence,
  searchMatterDocumentsHybrid,
} from "@/modules/matter-rag/search";

/**
 * Matter documents stay in their own retrieval namespace (Matter RAG).
 * Public legal corpus search never calls this source.
 */
export class MatterDocumentRetrievalSource implements RetrievalSource {
  readonly kind = "MATTER_DOCUMENT" as const;

  async search(
    input: RetrievalSourceQuery & { auth?: AuthContext; workspaceId?: string },
  ): Promise<LegalEvidence[]> {
    if (!input.matterId || !input.auth) {
      throw forbidden("Matter retrieval requires an authorized matter context");
    }
    const access = await assertMatterAccess({
      matterId: input.matterId,
      context: input.auth,
    });
    const workspaceId = input.workspaceId ?? access.workspaceId;
    if (workspaceId !== access.workspaceId) {
      throw forbidden("Workspace/matter mismatch for Matter RAG");
    }

    const hits = await searchMatterDocumentsHybrid({
      query: input.query,
      matterId: input.matterId,
      workspaceId,
      auth: input.auth,
      limit: input.limit,
    });
    return matterHitsToEvidence(hits, input.matterId);
  }
}
