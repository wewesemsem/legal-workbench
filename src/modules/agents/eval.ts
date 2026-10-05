/**
 * Evaluation set for dynamic agent behavior (Phase 4 add-on).
 */
export type AgentEvalCase = {
  id: string;
  category:
    | "RESEARCH"
    | "DOCUMENTS"
    | "DRAFTING"
    | "REVIEW"
    | "ORCHESTRATION"
    | "PLANNER";
  task: string;
  expectWorkflow?: string;
  expectAgents?: string[];
  notes: string;
};

export const AGENT_EVAL_CASES: AgentEvalCase[] = [
  {
    id: "simple-summarize-document",
    category: "DOCUMENTS",
    task: "Summarize this document.",
    expectWorkflow: "DOCUMENT_ANALYSIS",
    expectAgents: ["DOCUMENT", "REVIEW"],
    notes: "Simple document task → Document Agent",
  },
  {
    id: "research-constitution-equality",
    category: "RESEARCH",
    task: "Research Egyptian constitutional equality.",
    expectWorkflow: "RESEARCH",
    expectAgents: ["RESEARCH"],
    notes: "Research task → Research Agent",
  },
  {
    id: "compound-contract-review",
    category: "ORCHESTRATION",
    task: "Review this contract against Egyptian law.",
    expectWorkflow: "CONTRACT_REVIEW",
    expectAgents: ["DOCUMENT", "RESEARCH", "REVIEW"],
    notes: "Compound → Document + Research + Review",
  },
  {
    id: "drafting-from-findings",
    category: "DRAFTING",
    task: "Draft a letter based on the findings.",
    expectWorkflow: "DRAFTING",
    expectAgents: ["DRAFTING", "REVIEW"],
    notes: "Drafting task → Drafting Agent",
  },
  {
    id: "full-letter-workflow",
    category: "ORCHESTRATION",
    task:
      "Review this employment contract against Egyptian law, identify the legal issues, and draft a letter explaining the issues.",
    expectWorkflow: "FULL_CONTRACT_LETTER",
    expectAgents: ["DOCUMENT", "RESEARCH", "REVIEW", "DRAFTING", "REVIEW"],
    notes: "Required multi-agent letter workflow",
  },
  {
    id: "find-termination-clause",
    category: "DOCUMENTS",
    task: "Find the termination clause in this contract.",
    expectWorkflow: "DOCUMENT_ANALYSIS",
    expectAgents: ["DOCUMENT", "REVIEW"],
    notes: "Matter RAG page retrieval",
  },
  {
    id: "research-constitution-en",
    category: "RESEARCH",
    task: "What does the Egyptian Constitution say about equality?",
    expectWorkflow: "RESEARCH",
    expectAgents: ["RESEARCH"],
    notes: "Browser QA research prompt",
  },
];

export function scorePlannerCase(input: {
  expectedAgents: string[];
  actualAgents: string[];
}): { agentSelectionAccurate: boolean } {
  return {
    agentSelectionAccurate:
      input.expectedAgents.length === input.actualAgents.length &&
      input.expectedAgents.every(
        (agent, index) => agent === input.actualAgents[index],
      ),
  };
}
