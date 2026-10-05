import { createEmbeddingProviderFromConfig } from "@/modules/legal-retrieval/model-gateway";
import type { EmbeddingProvider } from "@/modules/legal-retrieval/embeddings/types";

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) {
    return cached;
  }
  cached = createEmbeddingProviderFromConfig();
  return cached;
}

export function resetEmbeddingProviderForTests(provider?: EmbeddingProvider) {
  cached = provider ?? null;
}

export type { EmbeddingProvider } from "@/modules/legal-retrieval/embeddings/types";
