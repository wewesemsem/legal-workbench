export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatResult = {
  content: string;
  provider: "mock" | "openai";
  model: string;
  latencyMs: number;
  /** Extensible; never include secrets or full document contents. */
  metadata: Record<string, unknown>;
};

export interface LlmService {
  chat(input: {
    messages: LlmChatMessage[];
    /** Soft timeout hint for providers that support abort. */
    timeoutMs?: number;
  }): Promise<LlmChatResult>;
}
