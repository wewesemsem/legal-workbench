import { getEnv } from "@/lib/env";
import { createAnthropicLlmService } from "@/modules/llm/anthropic";
import { createGeminiLlmService } from "@/modules/llm/gemini";
import { createMockLlmService } from "@/modules/llm/mock";
import { createOpenAiLlmService } from "@/modules/llm/openai";
import { resolveLlmSelection } from "@/modules/llm/model-catalog";
import type { LlmProviderId, LlmService } from "@/modules/llm/types";

const cachedByProvider = new Map<LlmProviderId, LlmService>();

export function createLlmService(provider: LlmProviderId): LlmService {
  switch (provider) {
    case "openai":
      return createOpenAiLlmService();
    case "anthropic":
      return createAnthropicLlmService();
    case "gemini":
      return createGeminiLlmService();
    case "mock":
    default:
      return createMockLlmService();
  }
}

export function getLlmService(provider?: LlmProviderId): LlmService {
  const selected = provider ?? getEnv().LLM_PROVIDER;
  const cached = cachedByProvider.get(selected);
  if (cached) {
    return cached;
  }
  const service = createLlmService(selected);
  cachedByProvider.set(selected, service);
  return service;
}

export async function chatWithLlmSelection(input: {
  messages: Parameters<LlmService["chat"]>[0]["messages"];
  provider?: string | null;
  model?: string | null;
  timeoutMs?: number;
}) {
  const selection = await resolveLlmSelection({
    provider: input.provider,
    model: input.model,
  });
  const service = getLlmService(selection.provider);
  return service.chat({
    messages: input.messages,
    model: selection.model,
    timeoutMs: input.timeoutMs,
  });
}

export function resetLlmServiceForTests(service?: LlmService) {
  cachedByProvider.clear();
  if (service) {
    cachedByProvider.set(getEnv().LLM_PROVIDER, service);
  }
}

export type {
  LlmChatMessage,
  LlmChatResult,
  LlmModelOption,
  LlmProviderCatalog,
  LlmProviderId,
  LlmService,
} from "@/modules/llm/types";
export { LLM_PROVIDER_LABELS, LIVE_LLM_PROVIDERS } from "@/modules/llm/types";
export { getLlmCatalog, resolveLlmSelection } from "@/modules/llm/model-catalog";
