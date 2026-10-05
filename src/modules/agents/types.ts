import type { AuthContext } from "@/modules/authorization/permissions";
import type { ResolvedConversationContext } from "@/modules/legal-retrieval/conversation-context";
import type { RetrievalIntent } from "@/modules/legal-retrieval/resolve-intent";
import type { ResearchTarget } from "@/modules/legal-retrieval/research-target";
import type { LegalCitation, LegalEvidence } from "@/modules/legal-retrieval/types";

export type AgentType =
  | "ORCHESTRATOR"
  | "RESEARCH"
  | "DOCUMENT"
  | "DRAFTING"
  | "REVIEW";

export type AgentRunStatus =
  | "PENDING"
  | "PLANNING"
  | "RUNNING"
  | "WAITING_FOR_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "INCOMPLETE";

export type AgentStepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EDITED"
  | "CANCELLED";

export type ToolRiskLevel = "READ" | "WRITE" | "EXTERNAL_ACTION";

export type WorkflowKind =
  | "RESEARCH"
  | "DOCUMENT_ANALYSIS"
  | "DRAFTING"
  | "REVIEW"
  | "CONTRACT_REVIEW"
  | "RESEARCH_AND_DRAFT"
  | "FULL_CONTRACT_LETTER"
  | "MEMORY_UPDATE";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export type ReviewSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ReviewFindingType =
  | "UNSUPPORTED_CLAIM"
  | "MISSING_CITATION"
  | "CONTRADICTION"
  | "AMBIGUOUS_LANGUAGE"
  | "MISSING_EVIDENCE"
  | "POTENTIAL_ISSUE"
  | "HALLUCINATED_AUTHORITY";

export type AgentPermissions = {
  globalRole: "LAWYER" | "CLIENT";
  matterRole: "LAWYER" | "CLIENT";
  canRunResearch: boolean;
  canRunDocumentAnalysis: boolean;
  canRunDrafting: boolean;
  canRunReview: boolean;
  canApprove: boolean;
};

export type AgentMemorySnapshot = {
  formatted: string;
  matterFacts: Array<{ key: string; value: string; sourceType: string }>;
  resolvedInstructions: {
    language?: string;
    draftingStyle?: string;
    citationStyle?: string;
    tone?: string;
    outputStructure?: string;
  };
  conflictCount: number;
};

export type AgentContext = {
  runId: string;
  user: AuthContext;
  workspaceId: string;
  matterId: string;
  matterTitle: string;
  participants: Array<{
    userId: string;
    role: "LAWYER" | "CLIENT";
    firstName: string;
    lastName: string;
  }>;
  conversationId: string | null;
  relevantDocuments: Array<{
    id: string;
    filename: string;
    processingStatus: string;
    pageCount: number | null;
  }>;
  retrievedEvidence: LegalEvidence[];
  citations: LegalCitation[];
  /** Contextual memory only — never legal authority. */
  memory: AgentMemorySnapshot;
  task: string;
  /**
   * LLM-resolved retrieval targets for the current task.
   * Used by corpus tools so natural-language asks hit exact lookups.
   */
  retrievalIntent?: RetrievalIntent | null;
  /** Conversation-resolved research target for this turn. */
  researchTarget?: ResearchTarget | null;
  /** Full conversation resolution (relation, active context, UI steps). */
  conversationContext?: ResolvedConversationContext | null;
  permissions: AgentPermissions;
  toolPermissions: string[];
  approvalState: ApprovalStatus | null;
  priorResults: Record<string, unknown>;
  limits: AgentExecutionLimits;
};

export type AgentExecutionLimits = {
  maxSteps: number;
  maxToolCalls: number;
  maxRetries: number;
  maxExecutionMs: number;
};

export type AgentDefinition = {
  id: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  systemInstructions: string;
  allowedTools: string[];
};

export type AgentResult = {
  agentType: AgentType;
  summary: string;
  output: Record<string, unknown>;
  evidenceIds: string[];
  citationIds: string[];
  openQuestions: string[];
  requiresApproval: boolean;
  approvalAction?: string;
  statusSummary: string;
  incomplete?: boolean;
};

export type ResearchAgentOutput = {
  summary: string;
  /** Grounded answer to the research question (not just an evidence inventory). */
  answer: string;
  authorities: Array<{
    source_type: "LEGAL_CORPUS" | "WEB_RESEARCH";
    title: string;
    article: string | null;
    evidence: string;
    citation_id: string;
    source_url: string | null;
    authority_level: string | null;
    date: string | null;
  }>;
  web_sources: Array<{
    title: string;
    url: string;
    domain: string;
    authority_status: string;
    excerpt: string | null;
  }>;
  open_questions: string[];
  confidence: ConfidenceLevel;
  evidence_ids: string[];
  citation_ids: string[];
  limitation?: string | null;
};

export type DocumentAgentOutput = {
  summary: string;
  documents: Array<{
    document_id: string;
    filename: string;
    page_count: number;
    clauses: string[];
    entities: string[];
    excerpts: Array<{ page: number; text: string }>;
  }>;
  open_questions: string[];
  evidence_ids: string[];
};

export type DraftSectionKind =
  | "SOURCE_FACT"
  | "LEGAL_AUTHORITY"
  | "INFERENCE"
  | "DRAFT_LANGUAGE";

export type DraftingAgentOutput = {
  title: string;
  draft_type: string;
  sections: Array<{
    kind: DraftSectionKind;
    content: string;
    evidence_ids?: string[];
    citation_ids?: string[];
  }>;
  full_text: string;
  citation_ids: string[];
  evidence_ids: string[];
  open_questions: string[];
};

export type ReviewFinding = {
  severity: ReviewSeverity;
  type: ReviewFindingType;
  location: string;
  description: string;
  evidence: string[];
  recommended_action: string;
};

export type ReviewAgentOutput = {
  findings: ReviewFinding[];
  summary: string;
  unsupported_claim_count: number;
  citation_issues: number;
};

export type PlannedAgentStep = {
  agent: AgentType;
  task: string;
  tools?: string[];
  expectedOutput?: string;
  requiresApproval?: boolean;
  riskLevel?: ToolRiskLevel;
  needsEvidence?: boolean;
};

export type ExecutionPlan = {
  workflow: WorkflowKind;
  goal?: string;
  steps: AgentType[];
  detailedSteps?: PlannedAgentStep[];
  rationale: string;
  requiresApproval?: boolean;
  source?: "ai" | "deterministic";
};

export type AgentToolDecision =
  | {
      type: "tool";
      tool: string;
      input: Record<string, unknown>;
      reason?: string;
    }
  | {
      type: "finalize";
      summary: string;
      output?: Record<string, unknown>;
      requiresApproval?: boolean;
      incomplete?: boolean;
    };

export type ToolExecutionContext = {
  agentContext: AgentContext;
  agentType: AgentType;
  allowedTools: readonly string[];
  toolCallCount: { current: number };
};
