import { getLegalEmbeddingConfig } from "@/modules/legal-retrieval/config";
import { createHashEmbeddingProvider } from "@/modules/legal-retrieval/embeddings/hash";
import { createOpenAiEmbeddingProvider } from "@/modules/legal-retrieval/embeddings/openai";
import type { EmbeddingProvider } from "@/modules/legal-retrieval/embeddings/types";

/**
 * Provider-independent embedding gateway.
 *
 * LegalEmbeddingService talks only to this gateway. Swap OpenAI / Google /
 * Anthropic / future models by adding a provider factory — do not hard-wire
 * vendor SDKs into retrieval ranking or indexing callers.
 */
export function createEmbeddingProviderFromConfig(): EmbeddingProvider {
  const config = getLegalEmbeddingConfig();
  switch (config.provider) {
    case "openai":
      return createOpenAiEmbeddingProvider(config);
    case "mock":
      return createHashEmbeddingProvider(config);
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`Unsupported embedding provider: ${String(exhaustive)}`);
    }
  }
}
