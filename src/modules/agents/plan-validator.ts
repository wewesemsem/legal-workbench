import { toolAllowlistForAgent } from "@/modules/agents/permissions";
import type {
  AgentPermissions,
  AgentType,
  ExecutionPlan,
  PlannedAgentStep,
  ToolRiskLevel,
} from "@/modules/agents/types";
import { getToolRegistry } from "@/modules/agents/tools/registry";

const ENABLED_AGENTS: AgentType[] = [
  "RESEARCH",
  "DOCUMENT",
  "DRAFTING",
  "REVIEW",
];

export type PlanValidationResult =
  | { ok: true; plan: ExecutionPlan }
  | { ok: false; errors: string[] };

function normalizeAgent(value: unknown): AgentType | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if (
    upper === "RESEARCH" ||
    upper === "DOCUMENT" ||
    upper === "DRAFTING" ||
    upper === "REVIEW"
  ) {
    return upper;
  }
  return null;
}

/**
 * Validate a proposed plan. The planner proposes; the orchestrator enforces.
 */
export function validateExecutionPlan(input: {
  proposed: unknown;
  permissions: AgentPermissions;
  maxSteps: number;
}): PlanValidationResult {
  const errors: string[] = [];
  if (!input.proposed || typeof input.proposed !== "object") {
    return { ok: false, errors: ["Plan must be an object"] };
  }

  const proposed = input.proposed as Record<string, unknown>;
  const goal =
    typeof proposed.goal === "string" && proposed.goal.trim()
      ? proposed.goal.trim()
      : typeof proposed.rationale === "string"
        ? proposed.rationale
        : "Agent workflow";

  if (proposed.workflow === "MEMORY_UPDATE") {
    return {
      ok: true,
      plan: {
        workflow: "MEMORY_UPDATE",
        goal,
        rationale:
          typeof proposed.rationale === "string"
            ? proposed.rationale
            : "Memory update proposal",
        steps: [],
        detailedSteps: [],
        requiresApproval: true,
        source:
          proposed.source === "ai" || proposed.source === "deterministic"
            ? proposed.source
            : "deterministic",
      },
    };
  }

  const rawSteps = Array.isArray(proposed.steps) ? proposed.steps : null;
  if (!rawSteps?.length) {
    return { ok: false, errors: ["Plan must include at least one step"] };
  }
  if (rawSteps.length > input.maxSteps) {
    errors.push(`Plan exceeds maximum steps (${input.maxSteps})`);
  }

  const registry = getToolRegistry();
  const steps: PlannedAgentStep[] = [];

  for (const [index, raw] of rawSteps.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`Step ${index + 1} is invalid`);
      continue;
    }
    const row = raw as Record<string, unknown>;
    const agent =
      normalizeAgent(row.agent) ??
      normalizeAgent(row.agentType) ??
      normalizeAgent(row.agent_type);
    if (!agent || !ENABLED_AGENTS.includes(agent)) {
      errors.push(`Step ${index + 1} uses unknown or disabled agent`);
      continue;
    }
    if (agent === "RESEARCH" && !input.permissions.canRunResearch) {
      errors.push("Research agent is not permitted for this user");
    }
    if (agent === "DRAFTING" && !input.permissions.canRunDrafting) {
      errors.push("Drafting agent is not permitted for this user");
    }
    if (agent === "REVIEW" && !input.permissions.canRunReview) {
      errors.push("Review agent is not permitted for this user");
    }
    if (agent === "DOCUMENT" && !input.permissions.canRunDocumentAnalysis) {
      errors.push("Document agent is not permitted for this user");
    }

    const task =
      typeof row.task === "string" && row.task.trim()
        ? row.task.trim()
        : goal;

    const allowlist = new Set(toolAllowlistForAgent(agent));
    const requestedTools = Array.isArray(row.tools)
      ? row.tools.filter((item): item is string => typeof item === "string")
      : [];
    for (const toolName of requestedTools) {
      if (!allowlist.has(toolName)) {
        errors.push(
          `Step ${index + 1}: tool ${toolName} is not allowed for ${agent}`,
        );
      }
      const tool = registry.get(toolName);
      if (!tool) {
        errors.push(`Step ${index + 1}: tool ${toolName} is not registered`);
      } else if (tool.riskLevel === "EXTERNAL_ACTION") {
        errors.push(
          `Step ${index + 1}: EXTERNAL_ACTION tool ${toolName} cannot be planned for automatic execution`,
        );
      }
    }

    const requiresApproval =
      row.requiresApproval === true ||
      agent === "DRAFTING" ||
      requestedTools.some((name) => {
        const tool = registry.get(name);
        return tool?.riskLevel === "WRITE" || tool?.riskLevel === "EXTERNAL_ACTION";
      });

    const riskLevel: ToolRiskLevel = requiresApproval
      ? agent === "DRAFTING"
        ? "WRITE"
        : "WRITE"
      : "READ";

    steps.push({
      agent,
      task,
      tools: requestedTools.filter((name) => allowlist.has(name)),
      expectedOutput:
        typeof row.expectedOutput === "string"
          ? row.expectedOutput
          : typeof row.expected_output === "string"
            ? row.expected_output
            : undefined,
      requiresApproval,
      riskLevel,
      needsEvidence:
        row.needsEvidence === true ||
        agent === "RESEARCH" ||
        agent === "DOCUMENT",
    });
  }

  if (!steps.length) {
    errors.push("No valid agent steps after validation");
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const workflow =
    typeof proposed.workflow === "string"
      ? (proposed.workflow as ExecutionPlan["workflow"])
      : inferWorkflow(steps.map((step) => step.agent));

  return {
    ok: true,
    plan: {
      workflow,
      goal,
      rationale:
        typeof proposed.rationale === "string"
          ? proposed.rationale
          : "Validated structured plan",
      steps: steps.map((step) => step.agent),
      detailedSteps: steps,
      requiresApproval: steps.some((step) => step.requiresApproval),
      source:
        proposed.source === "ai" || proposed.source === "deterministic"
          ? proposed.source
          : "ai",
    },
  };
}

function inferWorkflow(agents: AgentType[]): ExecutionPlan["workflow"] {
  const joined = agents.join(">");
  if (joined.includes("DOCUMENT") && joined.includes("RESEARCH") && joined.includes("DRAFTING")) {
    return "FULL_CONTRACT_LETTER";
  }
  if (joined.includes("DOCUMENT") && joined.includes("RESEARCH")) {
    return "CONTRACT_REVIEW";
  }
  if (joined.includes("RESEARCH") && joined.includes("DRAFTING")) {
    return "RESEARCH_AND_DRAFT";
  }
  if (agents[0] === "DOCUMENT") return "DOCUMENT_ANALYSIS";
  if (agents[0] === "DRAFTING") return "DRAFTING";
  if (agents[0] === "REVIEW") return "REVIEW";
  return "RESEARCH";
}
