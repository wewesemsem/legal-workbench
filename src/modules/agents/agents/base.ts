import type { ToolRegistry } from "@/modules/agents/tools/registry";
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  ToolExecutionContext,
} from "@/modules/agents/types";
import {
  createAgentStep,
  updateAgentStep,
} from "@/modules/agents/repository";
import { writeAgentAudit } from "@/modules/agents/audit";
import { isArabicOutputLanguage } from "@/modules/agents/prompts";

export interface LegalAgent {
  readonly definition: AgentDefinition;
  execute(context: AgentContext, task: string): Promise<AgentResult>;
}

export type AgentRuntime = {
  registry: ToolRegistry;
  startedAt: number;
  stepSequence: { current: number };
};

export function createToolContext(
  context: AgentContext,
  agentType: AgentDefinition["id"],
  allowedTools: readonly string[],
  toolCallCount: { current: number },
): ToolExecutionContext {
  return {
    agentContext: context,
    agentType,
    allowedTools,
    toolCallCount,
  };
}

export async function recordStep(input: {
  context: AgentContext;
  runtime: AgentRuntime;
  agentType: AgentDefinition["id"];
  action: string;
  tool?: string | null;
  inputMetadata?: Record<string, unknown>;
  outputMetadata?: Record<string, unknown>;
  status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
}) {
  input.runtime.stepSequence.current += 1;
  if (input.runtime.stepSequence.current > input.context.limits.maxSteps) {
    throw new Error("Maximum agent steps exceeded");
  }
  if (Date.now() - input.runtime.startedAt > input.context.limits.maxExecutionMs) {
    throw new Error("Maximum agent execution time exceeded");
  }

  return createAgentStep({
    agentRunId: input.context.runId,
    sequence: input.runtime.stepSequence.current,
    agentType: input.agentType,
    action: input.action,
    tool: input.tool,
    inputMetadata: input.inputMetadata,
    outputMetadata: input.outputMetadata,
    status: input.status ?? "COMPLETED",
  });
}

function runningToolSummary(toolName: string, language?: string | null) {
  const arabic = isArabicOutputLanguage(language);
  switch (toolName) {
    case "search_legal_corpus":
      return arabic
        ? "جارٍ البحث في المجموعة القانونية…"
        : "Searching legal corpus…";
    case "retrieve_legal_provision":
      return arabic
        ? "جارٍ استرجاع الحكم القانوني…"
        : "Retrieving legal provision…";
    case "search_web":
      return arabic ? "جارٍ البحث على الويب…" : "Searching the web…";
    case "retrieve_document":
      return arabic
        ? "جارٍ استرجاع مستند القضية…"
        : "Retrieving matter document…";
    case "search_matter_documents":
      return arabic
        ? "جارٍ البحث في مستندات القضية…"
        : "Searching matter documents…";
    case "create_draft":
      return arabic ? "جارٍ إنشاء المسودة…" : "Creating draft…";
    case "request_approval":
      return arabic ? "جارٍ طلب الموافقة…" : "Requesting approval…";
    case "build_legal_context":
      return arabic ? "جارٍ بناء السياق القانوني…" : "Building legal context…";
    case "draft_document":
      return arabic ? "جارٍ صياغة المستند…" : "Drafting document…";
    default:
      return arabic
        ? "جارٍ التشغيل…"
        : `Running ${toolName.replaceAll("_", " ")}…`;
  }
}

export async function invokeAllowedTool(input: {
  context: AgentContext;
  runtime: AgentRuntime;
  agent: AgentDefinition;
  toolName: string;
  toolInput: unknown;
  toolCallCount: { current: number };
}) {
  const toolContext = createToolContext(
    input.context,
    input.agent.id,
    input.agent.allowedTools,
    input.toolCallCount,
  );
  const language = input.context.memory.resolvedInstructions.language;
  const inputMetadata = {
    // Never log full document/prompt contents.
    keys:
      input.toolInput && typeof input.toolInput === "object"
        ? Object.keys(input.toolInput as object)
        : [],
  };
  const stepId = await recordStep({
    context: input.context,
    runtime: input.runtime,
    agentType: input.agent.id,
    action: `tool:${input.toolName}`,
    tool: input.toolName,
    inputMetadata,
    outputMetadata: {
      summary: runningToolSummary(input.toolName, language),
    },
    status: "RUNNING",
  });

  const result = await input.runtime.registry.invoke(
    input.toolName,
    input.toolInput,
    toolContext,
  );

  await updateAgentStep({
    id: stepId,
    action: result.ok
      ? `tool:${input.toolName}`
      : `tool_failed:${input.toolName}`,
    tool: input.toolName,
    inputMetadata,
    outputMetadata: result.ok
      ? { summary: result.summary, riskLevel: result.riskLevel }
      : { error: result.error, code: result.code, summary: result.error },
    status: result.ok ? "COMPLETED" : "FAILED",
  });

  await writeAgentAudit({
    workspaceId: input.context.workspaceId,
    matterId: input.context.matterId,
    agentRunId: input.context.runId,
    actorUserId: input.context.user.userId,
    action: result.ok ? "tool.invoked" : "tool.failed",
    metadata: {
      tool: input.toolName,
      agentType: input.agent.id,
      ok: result.ok,
      code: result.ok ? undefined : result.code,
    },
  });

  return result;
}

export function mergeEvidenceIds(
  ...lists: Array<string[] | undefined>
): string[] {
  return [...new Set(lists.flatMap((list) => list ?? []))];
}
