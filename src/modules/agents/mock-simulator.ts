import type { ChooseNextActionInput } from "@/modules/agents/model-gateway";
import type { AgentToolDecision } from "@/modules/agents/types";

/**
 * Deterministic mock tool-calling simulator for tests (LLM_PROVIDER=mock).
 * Simulates dynamic tool selection without external API credentials.
 */
export function simulateMockToolDecision(
  input: ChooseNextActionInput,
): AgentToolDecision {
  const observations = input.observations.toLowerCase();
  const allowed = new Set(input.allowedTools);
  const called = (name: string) => observations.includes(`tool:${name}`);

  if (input.agentType === "RESEARCH") {
    if (!called("retrieve_web_source") && allowed.has("retrieve_web_source")) {
      return {
        type: "tool",
        tool: "retrieve_web_source",
        input: { query: input.task, sourceMode: "BOTH" },
        reason: "Gather corpus + web evidence",
      };
    }
    if (!called("build_legal_context") && allowed.has("build_legal_context")) {
      return {
        type: "tool",
        tool: "build_legal_context",
        input: { evidenceIds: [] },
        reason: "Format grounded legal context",
      };
    }
    return {
      type: "finalize",
      summary: "Research complete from available tools.",
    };
  }

  if (input.agentType === "DOCUMENT") {
    if (!called("list_matter_documents") && allowed.has("list_matter_documents")) {
      return {
        type: "tool",
        tool: "list_matter_documents",
        input: {},
        reason: "List authorized matter documents",
      };
    }
    if (!called("search_matter_documents") && allowed.has("search_matter_documents")) {
      return {
        type: "tool",
        tool: "search_matter_documents",
        input: { query: extractSearchQuery(input.task), limit: 8 },
        reason: "Hybrid Matter RAG search",
      };
    }
    return {
      type: "finalize",
      summary: "Document analysis complete from Matter RAG results.",
    };
  }

  if (input.agentType === "DRAFTING") {
    if (!called("build_legal_context") && allowed.has("build_legal_context")) {
      return {
        type: "tool",
        tool: "build_legal_context",
        input: { evidenceIds: [] },
        reason: "Gather evidence context for drafting",
      };
    }
    if (!called("create_draft") && allowed.has("create_draft")) {
      return {
        type: "tool",
        tool: "create_draft",
        input: {
          title: "Grounded legal draft",
          draftType: "LETTER",
          fullText: buildMockDraft(input),
          sections: [
            {
              kind: "SOURCE_FACT",
              content: "Matter facts from retrieved document evidence.",
            },
            {
              kind: "LEGAL_AUTHORITY",
              content: "Legal authorities from retrieved research evidence only.",
            },
            {
              kind: "INFERENCE",
              content: "Issues may warrant lawyer review based on available evidence.",
            },
            {
              kind: "DRAFT_LANGUAGE",
              content: buildMockDraft(input),
            },
          ],
          evidenceIds: [],
          citationIds: [],
        },
        reason: "Create grounded draft object",
      };
    }
    if (!called("request_approval") && allowed.has("request_approval")) {
      return {
        type: "tool",
        tool: "request_approval",
        input: {
          action: "create_draft",
          description:
            "Draft requires lawyer review before external use.",
          proposedOutput: { title: "Grounded legal draft" },
          riskLevel: "WRITE",
        },
        reason: "Request human approval",
      };
    }
    return {
      type: "finalize",
      summary: "Draft created and pending human approval.",
      requiresApproval: true,
      output: {
        title: "Grounded legal draft",
        draft_type: "LETTER",
        full_text: buildMockDraft(input),
        sections: [],
        citation_ids: [],
        evidence_ids: [],
        open_questions: ["Lawyer must approve before external use."],
      },
    };
  }

  if (input.agentType === "REVIEW") {
    if (!called("record_review_findings") && allowed.has("record_review_findings")) {
      return {
        type: "tool",
        tool: "record_review_findings",
        input: {
          summary: "Review completed against available evidence.",
          findings: [
            {
              severity: "MEDIUM",
              type: "POTENTIAL_ISSUE",
              location: "overall",
              description:
                "Lawyer judgment still required; automatic review flags priority items only.",
              evidence: [],
              recommended_action: "Perform final human review.",
            },
          ],
        },
        reason: "Record structured findings",
      };
    }
    return {
      type: "finalize",
      summary: "Review complete.",
    };
  }

  return {
    type: "finalize",
    summary: "No further tools available.",
    incomplete: true,
  };
}

function extractSearchQuery(task: string) {
  const lowered = task.toLowerCase();
  if (lowered.includes("termination")) return "termination";
  if (lowered.includes("clause")) return "clause";
  const tokens = task.split(/\s+/).filter((token) => token.length > 3);
  return tokens.slice(0, 6).join(" ") || "contract";
}

function buildMockDraft(input: ChooseNextActionInput) {
  const clientMatch = input.matterContext.match(
    /\[(?:LAWYER_CONFIRMED|USER_PROVIDED|DOCUMENT_DERIVED|CONVERSATION_DERIVED|AI_DERIVED)[^\]]*\]\s*client:\s*(.+)/i,
  );
  const clientLine = clientMatch?.[1]
    ? `On behalf of ${clientMatch[1].trim()} (MEMORY CONTEXT, not legal authority).`
    : "On behalf of our client.";

  return [
    "Dear Sir/Madam,",
    "",
    clientLine,
    "",
    "We write regarding issues identified from matter documents and retrieved legal evidence.",
    "",
    "Matter facts and legal authorities are limited to tool-retrieved evidence.",
    "Memory is contextual only and is not treated as legal authority.",
    "This draft does not invent citations.",
    "",
    `Task: ${input.task.slice(0, 240)}`,
    "",
    "This draft requires lawyer approval before any external use.",
    "",
    "Respectfully,",
  ].join("\n");
}
