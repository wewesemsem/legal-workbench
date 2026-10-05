import { getEnv } from "@/lib/env";
import type { LlmChatResult, LlmService } from "@/modules/llm/types";

export function createOpenAiLlmService(): LlmService {
  const env = getEnv();

  return {
    async chat({ messages, timeoutMs = 45_000 }) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.OPENAI_MODEL,
            messages,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`OpenAI request failed with status ${response.status}`);
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
          model: payload.model || env.OPENAI_MODEL,
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
