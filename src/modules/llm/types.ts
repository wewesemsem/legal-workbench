export type LlmProviderId = "mock" | "openai" | "anthropic" | "gemini";

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatResult = {
  content: string;
  provider: LlmProviderId;
  model: string;
  latencyMs: number;
  /** Extensible; never include secrets or full document contents. */
  metadata: Record<string, unknown>;
};

export type LlmModelOption = {
  id: string;
  label: string;
  createdAt?: number | null;
};

export type LlmProviderCatalog = {
  id: LlmProviderId;
  label: string;
  configured: boolean;
  /** Dynamically resolved latest / recommended chat model for this provider. */
  latestModelId: string | null;
  models: LlmModelOption[];
  error?: string;
};

export interface LlmService {
  chat(input: {
    messages: LlmChatMessage[];
    /** Override the provider default / env model for this call. */
    model?: string;
    /** Soft timeout hint for providers that support abort. */
    timeoutMs?: number;
  }): Promise<LlmChatResult>;
}

export const LLM_PROVIDER_LABELS: Record<LlmProviderId, string> = {
  mock: "Mock (local)",
  openai: "OpenAI",
  anthropic: "Claude",
  gemini: "Gemini",
};

export const LIVE_LLM_PROVIDERS: Exclude<LlmProviderId, "mock">[] = [
  "openai",
  "anthropic",
  "gemini",
];
