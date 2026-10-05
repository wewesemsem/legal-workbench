import { getEnv } from "@/lib/env";
import type { AgentExecutionLimits } from "@/modules/agents/types";

export function getAgentEnv() {
  const env = getEnv();
  return {
    AGENT_MAX_STEPS: env.AGENT_MAX_STEPS,
    AGENT_MAX_TOOL_CALLS: env.AGENT_MAX_TOOL_CALLS,
    AGENT_MAX_RETRIES: env.AGENT_MAX_RETRIES,
    AGENT_MAX_EXECUTION_MS: env.AGENT_MAX_EXECUTION_MS,
    AGENT_RATE_LIMIT_WINDOW_MS: env.AGENT_RATE_LIMIT_WINDOW_MS,
    AGENT_RATE_LIMIT_MAX_ATTEMPTS: env.AGENT_RATE_LIMIT_MAX_ATTEMPTS,
  };
}

export function defaultAgentLimits(): AgentExecutionLimits {
  const env = getAgentEnv();
  return {
    maxSteps: env.AGENT_MAX_STEPS,
    maxToolCalls: env.AGENT_MAX_TOOL_CALLS,
    maxRetries: env.AGENT_MAX_RETRIES,
    maxExecutionMs: env.AGENT_MAX_EXECUTION_MS,
  };
}
