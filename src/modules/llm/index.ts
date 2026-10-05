import { getEnv } from "@/lib/env";
import { createMockLlmService } from "@/modules/llm/mock";
import { createOpenAiLlmService } from "@/modules/llm/openai";
import type { LlmService } from "@/modules/llm/types";

let cached: LlmService | null = null;

export function getLlmService(): LlmService {
  if (cached) {
    return cached;
  }

  const env = getEnv();
  cached =
    env.LLM_PROVIDER === "openai"
      ? createOpenAiLlmService()
      : createMockLlmService();
  return cached;
}

export function resetLlmServiceForTests(service?: LlmService) {
  cached = service ?? null;
}

export type { LlmChatMessage, LlmChatResult, LlmService } from "@/modules/llm/types";
