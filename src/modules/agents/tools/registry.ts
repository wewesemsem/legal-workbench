import { ZodError } from "zod";

import type { ToolExecutionContext } from "@/modules/agents/types";
import { ALL_AGENT_TOOLS } from "@/modules/agents/tools/definitions";
import type {
  AgentToolDefinition,
  ToolInvokeResult,
} from "@/modules/agents/tools/types";

export class ToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition>();

  constructor(tools: AgentToolDefinition[] = ALL_AGENT_TOOLS) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  list(): AgentToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): AgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async invoke(
    toolName: string,
    rawInput: unknown,
    context: ToolExecutionContext,
  ): Promise<ToolInvokeResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        ok: false,
        tool: toolName,
        error: "Tool is not registered",
        code: "UNAUTHORIZED_TOOL",
      };
    }

    if (!context.allowedTools.includes(toolName)) {
      return {
        ok: false,
        tool: toolName,
        error: `Agent ${context.agentType} is not allowed to call ${toolName}`,
        code: "UNAUTHORIZED_TOOL",
      };
    }

    if (tool.riskLevel === "EXTERNAL_ACTION" || !tool.enabled) {
      // Architecture supports future EXTERNAL_ACTION + HITL; Phase 4 returns NOT_IMPLEMENTED.
      return {
        ok: true,
        tool: toolName,
        riskLevel: tool.riskLevel,
        output: {
          status: "NOT_IMPLEMENTED",
          message:
            tool.riskLevel === "EXTERNAL_ACTION"
              ? "External actions are not implemented and require human approval before any future execution."
              : "Tool is disabled in this phase.",
          requiresHumanApproval: tool.riskLevel === "EXTERNAL_ACTION",
        },
        summary: `${toolName}: NOT_IMPLEMENTED`,
      };
    }

    const role = context.agentContext.permissions.matterRole;
    const globalRole = context.agentContext.permissions.globalRole;
    if (
      !tool.allowedRoles.includes(role) ||
      !tool.allowedRoles.includes(globalRole)
    ) {
      return {
        ok: false,
        tool: toolName,
        error: "Role is not permitted to invoke this tool",
        code: "PERMISSION_DENIED",
      };
    }

    if (context.toolCallCount.current >= context.agentContext.limits.maxToolCalls) {
      return {
        ok: false,
        tool: toolName,
        error: "Maximum tool calls exceeded for this agent run",
        code: "LIMIT_EXCEEDED",
      };
    }

    let parsedInput: unknown;
    try {
      parsedInput = tool.inputSchema.parse(rawInput ?? {});
    } catch (error) {
      const message =
        error instanceof ZodError
          ? error.issues.map((issue) => issue.message).join("; ")
          : "Invalid tool input";
      return {
        ok: false,
        tool: toolName,
        error: message,
        code: "SCHEMA_INVALID",
      };
    }

    context.toolCallCount.current += 1;

    try {
      const output = await tool.execute(parsedInput, context);
      return {
        ok: true,
        tool: toolName,
        riskLevel: tool.riskLevel,
        output,
        summary: summarizeToolOutput(toolName, output),
      };
    } catch (error) {
      return {
        ok: false,
        tool: toolName,
        error: error instanceof Error ? error.message : "Tool execution failed",
        code: "EXECUTION_FAILED",
      };
    }
  }
}

function summarizeToolOutput(toolName: string, output: unknown): string {
  if (!output || typeof output !== "object") {
    return `${toolName} completed`;
  }
  const record = output as Record<string, unknown>;
  if (typeof record.evidenceCount === "number") {
    return `${toolName}: ${record.evidenceCount} evidence item(s)`;
  }
  if (Array.isArray(record.documents)) {
    return `${toolName}: ${record.documents.length} document(s)`;
  }
  if (Array.isArray(record.hits)) {
    return `${toolName}: ${record.hits.length} hit(s)`;
  }
  if (Array.isArray(record.findings)) {
    return `${toolName}: ${record.findings.length} finding(s)`;
  }
  if (typeof record.title === "string") {
    return `${toolName}: draft "${record.title}"`;
  }
  if (typeof record.action === "string") {
    return `${toolName}: approval requested for ${record.action}`;
  }
  if (typeof record.memoryId === "string") {
    return `${toolName}: memory ${record.status ?? "ok"}`;
  }
  if (typeof record.matterCount === "number") {
    return `${toolName}: ${record.matterCount} matter memory item(s)`;
  }
  return `${toolName} completed`;
}

let defaultRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolRegistry();
  }
  return defaultRegistry;
}

export function resetToolRegistryForTests(registry?: ToolRegistry) {
  defaultRegistry = registry ?? null;
}
