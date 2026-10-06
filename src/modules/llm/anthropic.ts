import { getEnv } from "@/lib/env";
import type { LlmChatMessage, LlmChatResult, LlmService } from "@/modules/llm/types";

function toAnthropicMessages(messages: LlmChatMessage[]) {
  const systemParts: string[] = [];
  const converted: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    const content = message.content?.trim() ?? "";
    if (!content) {
      continue;
    }
    if (message.role === "system") {
      systemParts.push(content);
      continue;
    }
    const role = message.role === "assistant" ? "assistant" : "user";
    const last = converted[converted.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
      continue;
    }
    converted.push({ role, content });
  }

  // Anthropic requires the first message to be from the user.
  if (converted[0]?.role === "assistant") {
    converted.unshift({
      role: "user",
      content: "(continued)",
    });
  }

  if (!converted.length) {
    converted.push({
      role: "user",
      content: "Continue.",
    });
  }

  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages: converted,
  };
}

async function readAnthropicError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; type?: string };
      message?: string;
    };
    return (
      payload.error?.message ||
      payload.message ||
      `Anthropic request failed with status ${response.status}`
    );
  } catch {
    return `Anthropic request failed with status ${response.status}`;
  }
}

export function createAnthropicLlmService(defaultModel?: string): LlmService {
  const env = getEnv();
  const fallbackModel = defaultModel || env.ANTHROPIC_MODEL;

  return {
    async chat({ messages, model, timeoutMs = 45_000 }) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const selectedModel = model?.trim() || fallbackModel;
      const payloadMessages = toAnthropicMessages(messages);

      try {
        // Newer Claude models reject `temperature` (deprecated). Match
        // ScanAndFindIt and omit it entirely.
        const response = await fetch(`${env.ANTHROPIC_BASE_URL}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 4_096,
            system: payloadMessages.system,
            messages: payloadMessages.messages,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readAnthropicError(response));
        }

        const payload = (await response.json()) as {
          content?: Array<{ type?: string; text?: string }>;
          model?: string;
        };

        const content = payload.content
          ?.filter((block) => block.type === "text" && block.text)
          .map((block) => block.text?.trim() ?? "")
          .filter(Boolean)
          .join("\n")
          .trim();

        if (!content) {
          throw new Error("Anthropic returned an empty response");
        }

        const result: LlmChatResult = {
          content,
          provider: "anthropic",
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
