import { getEnv } from "@/lib/env";
import type { LlmChatMessage, LlmChatResult, LlmService } from "@/modules/llm/types";

function toGeminiContents(messages: LlmChatMessage[]) {
  const systemParts: string[] = [];
  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = [];

  for (const message of messages) {
    const text = message.content?.trim() ?? "";
    if (!text) {
      continue;
    }
    if (message.role === "system") {
      systemParts.push(text);
      continue;
    }
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text }],
    });
  }

  // Some Gemini specialty models reject `systemInstruction` / developer
  // instructions. Fold system text into the first user turn instead.
  if (systemParts.length) {
    const systemText = systemParts.join("\n\n");
    const firstUser = contents.find((entry) => entry.role === "user");
    if (firstUser) {
      firstUser.parts = [
        { text: `${systemText}\n\n${firstUser.parts[0]?.text ?? ""}`.trim() },
      ];
    } else {
      contents.unshift({
        role: "user",
        parts: [{ text: systemText }],
      });
    }
  }

  if (!contents.length) {
    contents.push({
      role: "user",
      parts: [{ text: "Continue." }],
    });
  }

  return { contents };
}

export function createGeminiLlmService(defaultModel?: string): LlmService {
  const env = getEnv();
  const fallbackModel = defaultModel || env.GEMINI_MODEL;

  return {
    async chat({ messages, model, timeoutMs = 45_000 }) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const selectedModel = (model?.trim() || fallbackModel).replace(
        /^models\//,
        "",
      );
      const body = toGeminiContents(messages);
      const url = new URL(
        `${env.GEMINI_BASE_URL}/models/${encodeURIComponent(selectedModel)}:generateContent`,
      );
      url.searchParams.set("key", env.GEMINI_API_KEY ?? "");

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: body.contents,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let detail = `Gemini request failed with status ${response.status}`;
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
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
          modelVersion?: string;
        };

        const content = payload.candidates?.[0]?.content?.parts
          ?.map((part) => part.text?.trim() ?? "")
          .filter(Boolean)
          .join("\n")
          .trim();

        if (!content) {
          throw new Error("Gemini returned an empty response");
        }

        const result: LlmChatResult = {
          content,
          provider: "gemini",
          model: payload.modelVersion || selectedModel,
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
