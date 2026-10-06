import { getEnv } from "@/lib/env";
import type { LlmChatResult, LlmService } from "@/modules/llm/types";

export function createOpenAiLlmService(defaultModel?: string): LlmService {
  const env = getEnv();
  const fallbackModel = defaultModel || env.OPENAI_MODEL;

  return {
    async chat({ messages, model, timeoutMs = 45_000 }) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const selectedModel = model?.trim() || fallbackModel;

      try {
        const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let detail = `OpenAI request failed with status ${response.status}`;
          try {
            const errBody = (await response.json()) as {
              error?: { message?: string };
            };
            if (errBody.error?.message) {
              detail = errBody.error.message;
            }
          } catch {
            // keep status message
          }
          throw new Error(detail);
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
          model?: string;
        };

        const content = payload.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new Error("OpenAI returned an empty response");
        }

        const result: LlmChatResult = {
          content,
          provider: "openai",
          model: payload.model || selectedModel,
          latencyMs: Date.now() - started,
          metadata: {
            mode: "matter_context_only",
          },
        };
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("LLM request timed out");
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
