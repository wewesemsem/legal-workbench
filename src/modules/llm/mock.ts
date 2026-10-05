import type { LlmChatResult, LlmService } from "@/modules/llm/types";

/**
 * Deterministic local LLM for development/tests.
 * Does not call external providers.
 */
export function createMockLlmService(): LlmService {
  return {
    async chat({ messages }) {
      const started = Date.now();
      const lastUser = [...messages]
        .reverse()
        .find((message) => message.role === "user");
      const question = lastUser?.content?.trim() || "";

      const content = [
        "I can help within this matter's authorized context only.",
        "I do not have access to Matter RAG or the public legal corpus yet.",
        "I will not invent documents, citations, or legal authorities.",
        "",
        question
          ? `You asked: ${question.slice(0, 500)}`
          : "Ask a question about this matter.",
        "",
        "If you need analysis of a specific uploaded document, share the relevant text or wait until Matter document retrieval is enabled.",
      ].join("\n");

      const result: LlmChatResult = {
        content,
        provider: "mock",
        model: "mock-matter-chat",
        latencyMs: Date.now() - started,
        metadata: {
          mode: "matter_context_only",
        },
      };
      return result;
    },
  };
}
