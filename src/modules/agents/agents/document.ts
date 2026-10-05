import type { AgentRuntime, LegalAgent } from "@/modules/agents/agents/base";
import { runAgentControlLoop } from "@/modules/agents/agents/control-loop";
import {
  DOCUMENT_AGENT_INSTRUCTIONS,
  SHARED_AGENT_SYSTEM,
} from "@/modules/agents/prompts";
import type {
  AgentDefinition,
  AgentResult,
  DocumentAgentOutput,
} from "@/modules/agents/types";

const DEFINITION: AgentDefinition = {
  id: "DOCUMENT",
  name: "Document Agent",
  description: "Analyzes matter documents via Matter RAG with page provenance.",
  capabilities: [
    "matter_hybrid_rag",
    "page_level_citations",
    "dynamic_tool_calling",
    "clause_extraction",
  ],
  systemInstructions: `${SHARED_AGENT_SYSTEM}\n\n${DOCUMENT_AGENT_INSTRUCTIONS}`,
  allowedTools: [
    "list_matter_documents",
    "search_matter_documents",
    "retrieve_document",
    "retrieve_document_page",
    "search_document_text",
    "retrieve_memory",
    "propose_memory",
  ],
};

export function createDocumentAgent(runtime: AgentRuntime): LegalAgent {
  return {
    definition: DEFINITION,
    async execute(context, task): Promise<AgentResult> {
      return runAgentControlLoop({
        context,
        runtime,
        agent: DEFINITION,
        task,
        buildFinalResult: ({ context: ctx, lastOutput, incomplete }) => {
          const matterHits =
            lastOutput && Array.isArray(lastOutput.hits)
              ? (lastOutput.hits as Array<{
                  documentId?: string;
                  filename?: string;
                  page?: number;
                  excerpt?: string;
                  chunkId?: string;
                }>)
              : [];

          const byDoc = new Map<
            string,
            DocumentAgentOutput["documents"][number]
          >();
          for (const hit of matterHits) {
            const id = hit.documentId ?? "unknown";
            const existing = byDoc.get(id) ?? {
              document_id: id,
              filename: hit.filename ?? id,
              page_count: 0,
              clauses: [],
              entities: [],
              excerpts: [],
            };
            if (hit.excerpt) {
              existing.clauses.push(hit.excerpt.slice(0, 280));
              existing.excerpts.push({
                page: hit.page ?? 1,
                text: hit.excerpt.slice(0, 400),
              });
            }
            existing.page_count = Math.max(
              existing.page_count,
              hit.page ?? existing.page_count,
            );
            byDoc.set(id, existing);
          }

          // Also fold Matter RAG evidence from context.
          for (const item of ctx.retrievedEvidence.filter(
            (evidence) => evidence.sourceKind === "MATTER_DOCUMENT",
          )) {
            const existing = byDoc.get(item.documentId) ?? {
              document_id: item.documentId,
              filename: item.title,
              page_count: 0,
              clauses: [],
              entities: [],
              excerpts: [],
            };
            existing.clauses.push(item.text.slice(0, 280));
            existing.excerpts.push({
              page: Number(item.provisionNumber ?? 1) || 1,
              text: item.text.slice(0, 400),
            });
            byDoc.set(item.documentId, existing);
          }

          const documents = [...byDoc.values()];
          const output: DocumentAgentOutput = {
            summary: documents.length
              ? `Matter RAG analyzed ${documents.length} document(s) with page-level excerpts.`
              : "No matter document evidence was retrieved.",
            documents,
            open_questions: documents.length
              ? []
              : ["Upload and process a matter document, then retry."],
            evidence_ids: ctx.retrievedEvidence
              .filter((item) => item.sourceKind === "MATTER_DOCUMENT")
              .map((item) => item.chunkId),
          };

          ctx.relevantDocuments = documents.map((doc) => ({
            id: doc.document_id,
            filename: doc.filename,
            processingStatus: "PROCESSED",
            pageCount: doc.page_count,
          }));

          return {
            agentType: "DOCUMENT",
            summary: output.summary,
            output: output as unknown as Record<string, unknown>,
            evidenceIds: output.evidence_ids,
            citationIds: [],
            openQuestions: output.open_questions,
            requiresApproval: false,
            statusSummary: incomplete
              ? "Document analysis incomplete"
              : `Analyzed ${documents.length} document(s) via Matter RAG`,
            incomplete,
          };
        },
      });
    },
  };
}
