import type { z } from "zod";

import type {
  ToolExecutionContext,
  ToolRiskLevel,
} from "@/modules/agents/types";

export type AgentToolDefinition = {
  name: string;
  description: string;
  // Parsed by the registry before execute(); tools may assume validated shape.
  inputSchema: z.ZodTypeAny;
  riskLevel: ToolRiskLevel;
  /** Roles that may invoke this tool via an agent. */
  allowedRoles: ReadonlyArray<"LAWYER" | "CLIENT">;
  /** EXTERNAL_ACTION tools are disabled in Phase 4 unless explicitly enabled. */
  enabled: boolean;
  execute: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any,
    context: ToolExecutionContext,
  ) => Promise<unknown>;
};

export type ToolInvokeResult =
  | {
      ok: true;
      tool: string;
      riskLevel: ToolRiskLevel;
      output: unknown;
      summary: string;
    }
  | {
      ok: false;
      tool: string;
      error: string;
      code:
        | "UNAUTHORIZED_TOOL"
        | "DISABLED_TOOL"
        | "RISK_BLOCKED"
        | "SCHEMA_INVALID"
        | "PERMISSION_DENIED"
        | "LIMIT_EXCEEDED"
        | "EXECUTION_FAILED";
    };
