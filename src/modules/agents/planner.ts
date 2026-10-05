import { getEnv } from "@/lib/env";
import { getAgentModelGateway } from "@/modules/agents/model-gateway";
import { validateExecutionPlan } from "@/modules/agents/plan-validator";
import type {
  AgentPermissions,
  AgentType,
  ExecutionPlan,
  PlannedAgentStep,
  WorkflowKind,
} from "@/modules/agents/types";

/**
 * Deterministic task classifier / planner (fallback when AI planner unavailable).
 */
export function classifyWorkflow(task: string): ExecutionPlan {
  const normalized = task.toLowerCase();

  const wantsMemory =
    /\b(remember that|remember:|save to memory|save to matter memory)\b/i.test(
      task,
    );
  const wantsDraft =
    /\b(draft|letter|memo|write|compose|صغ|خطاب|مذكرة)\b/i.test(task) ||
    normalized.includes("draft");
  const wantsReview =
    /\b(review|risk|issues?|flag|validate|راجع|مراجعة)\b/i.test(task) ||
    normalized.includes("review");
  const wantsDocs =
    /\b(document|contract|clause|upload|agreement|عقد|مستند|وثيقة|summarize)\b/i.test(
      task,
    ) || normalized.includes("contract");
  const wantsResearch =
    /\b(law|legal|article|statute|labor|egyptian|constitution|equality|قانون|مادة|تشريع|بحث|دستور)\b/i.test(
      task,
    ) ||
    normalized.includes("research") ||
    normalized.includes("corpus");

  // Explicit memory-save requests should not spawn research/drafting workflows.
  if (wantsMemory && !wantsDraft && !wantsDocs && !wantsResearch && !wantsReview) {
    return {
      workflow: "MEMORY_UPDATE",
      goal: "Propose matter memory for lawyer confirmation",
      steps: [],
      detailedSteps: [],
      rationale: "User asked to remember a stable fact for matter memory.",
      requiresApproval: true,
      source: "deterministic",
    };
  }

  // Pure legal research questions should not be forced into document workflows
  // just because they mention workplace topics (e.g. "employee termination").
  const researchOnly =
    wantsResearch &&
    !wantsDocs &&
    !wantsDraft &&
    /\b(find|what|research|regarding|about|ما|بحث)\b/i.test(task);

  if (researchOnly) {
    return toPlan(
      "RESEARCH",
      [step("RESEARCH", "Research legal authorities")],
      "Legal research only.",
    );
  }

  if (wantsDocs && wantsResearch && wantsDraft) {
    return toPlan("FULL_CONTRACT_LETTER", [
      step("DOCUMENT", "Identify relevant employment clauses"),
      step("RESEARCH", "Research applicable Egyptian law"),
      step("REVIEW", "Compare contract clauses against legal evidence"),
      step("DRAFTING", "Draft explanatory letter", true),
      step("REVIEW", "Validate draft and citations"),
    ], "Contract review against law with explanatory letter.");
  }

  if (wantsDocs && wantsResearch && wantsReview) {
    return toPlan(
      "CONTRACT_REVIEW",
      [
        step("DOCUMENT", "Extract relevant contract clauses"),
        step("RESEARCH", "Research applicable Egyptian law"),
        step("REVIEW", "Identify legal issues from evidence"),
      ],
      "Contract review against legal research.",
    );
  }

  if (wantsResearch && wantsDraft) {
    return toPlan(
      "RESEARCH_AND_DRAFT",
      [
        step("RESEARCH", "Research applicable legal authorities"),
        step("DRAFTING", "Draft document from research", true),
        step("REVIEW", "Validate draft and citations"),
      ],
      "Research then draft with review.",
    );
  }

  if (wantsDocs && (wantsReview || /\bsummarize|extract|find\b/i.test(task))) {
    return toPlan(
      "DOCUMENT_ANALYSIS",
      [
        step("DOCUMENT", "Analyze matter documents and retrieve relevant pages"),
        step("REVIEW", "Review document analysis for gaps"),
      ],
      "Document-focused analysis.",
    );
  }

  if (wantsDraft && !wantsResearch && !wantsDocs) {
    return toPlan(
      "DRAFTING",
      [
        step("DRAFTING", "Draft requested document", true),
        step("REVIEW", "Validate draft grounding"),
      ],
      "Drafting with review.",
    );
  }

  if (wantsReview && !wantsDocs && !wantsResearch && !wantsDraft) {
    return toPlan("REVIEW", [step("REVIEW", "Review work product")], "Standalone review.");
  }

  if (wantsDocs && !wantsResearch) {
    return toPlan(
      "DOCUMENT_ANALYSIS",
      [
        step("DOCUMENT", "Analyze matter documents"),
        step("REVIEW", "Review document findings"),
      ],
      "Document-focused analysis.",
    );
  }

  if (wantsResearch) {
    return toPlan(
      "RESEARCH",
      [step("RESEARCH", "Research legal authorities")],
      "Legal research only.",
    );
  }

  return toPlan(
    "RESEARCH",
    [step("RESEARCH", "Research legal authorities")],
    "Defaulted to research for an unclassified task.",
  );
}

function step(
  agent: AgentType,
  task: string,
  requiresApproval = false,
): PlannedAgentStep {
  return {
    agent,
    task,
    requiresApproval,
    needsEvidence: agent === "RESEARCH" || agent === "DOCUMENT",
    riskLevel: requiresApproval ? "WRITE" : "READ",
  };
}

function toPlan(
  workflow: WorkflowKind,
  detailedSteps: PlannedAgentStep[],
  rationale: string,
): ExecutionPlan {
  return {
    workflow,
    goal: rationale,
    steps: detailedSteps.map((item) => item.agent),
    detailedSteps,
    rationale,
    requiresApproval: detailedSteps.some((item) => item.requiresApproval),
    source: "deterministic",
  };
}

const PLANNER_SCHEMA = `{
  "goal": "string",
  "workflow": "RESEARCH|DOCUMENT_ANALYSIS|DRAFTING|REVIEW|CONTRACT_REVIEW|RESEARCH_AND_DRAFT|FULL_CONTRACT_LETTER",
  "rationale": "string",
  "steps": [
    {
      "agent": "DOCUMENT|RESEARCH|REVIEW|DRAFTING",
      "task": "string",
      "tools": ["optional allowlisted tool names"],
      "expectedOutput": "string",
      "requiresApproval": false,
      "needsEvidence": true
    }
  ]
}`;

/**
 * Structured AI planner with deterministic fallback.
 * Never executes tools — only proposes a plan for validation.
 */
export async function createExecutionPlan(input: {
  task: string;
  permissions: AgentPermissions;
  maxSteps: number;
  matterTitle?: string;
}): Promise<ExecutionPlan> {
  const fallback = classifyWorkflow(input.task);

  if (getEnv().LLM_PROVIDER === "mock") {
    // Mock mode: deterministic plan that still goes through the validator.
    const validated = validateExecutionPlan({
      proposed: { ...fallback, source: "deterministic" },
      permissions: input.permissions,
      maxSteps: input.maxSteps,
    });
    return validated.ok ? validated.plan : fallback;
  }

  try {
    const gateway = getAgentModelGateway();
    const proposed = await gateway.structuredOutput({
      system:
        "You are a legal workbench orchestrator planner. Propose a structured multi-agent plan. Never execute tools. Never invent agents outside DOCUMENT, RESEARCH, REVIEW, DRAFTING. Prefer the smallest safe plan. Drafting always requiresApproval=true.",
      instructions:
        "Return ONLY JSON matching the schema. Do not include chain-of-thought.",
      task: input.task,
      matterContext: `Matter: ${input.matterTitle ?? "unknown"}. Role: ${input.permissions.matterRole}.`,
      evidence: "(none yet — planning stage)",
      toolResults: "(none)",
      schemaHint: PLANNER_SCHEMA,
    });

    if (!proposed) {
      return fallback;
    }

    const validated = validateExecutionPlan({
      proposed: { ...proposed, source: "ai" },
      permissions: input.permissions,
      maxSteps: input.maxSteps,
    });
    if (validated.ok) {
      return validated.plan;
    }

    console.warn("[agents] AI plan rejected; using deterministic fallback", {
      errors: validated.errors,
    });
    return fallback;
  } catch (error) {
    console.warn("[agents] AI planner unavailable; using deterministic fallback", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return fallback;
  }
}
