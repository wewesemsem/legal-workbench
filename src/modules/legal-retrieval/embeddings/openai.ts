import { getEnv } from "@/lib/env";
import type { EmbeddingProvider } from "@/modules/legal-retrieval/embeddings/types";

export function createOpenAiEmbeddingProvider(input: {
  model: string;
  dimensions: number;
}): EmbeddingProvider {
  return {
    id: "openai",
    model: input.model,
    dimensions: input.dimensions,
    async embed(texts) {
      const env = getEnv();
      const vectors: number[][] = [];
      const batchSize = 64;
      for (let offset = 0; offset < texts.length; offset += batchSize) {
        const batch = texts.slice(offset, offset + batchSize);
        const response = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: input.model,
            input: batch,
            dimensions: input.dimensions,
          }),
        });
        if (!response.ok) {
          throw new Error(`Embedding request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as {
          data?: Array<{ index: number; embedding: number[] }>;
        };
        const ordered = [...(payload.data ?? [])].sort(
          (left, right) => left.index - right.index,
        );
        if (ordered.length !== batch.length) {
          throw new Error("Embedding provider returned an unexpected batch size");
        }
        for (const item of ordered) {
          if (item.embedding.length !== input.dimensions) {
            throw new Error(
              `Embedding width ${item.embedding.length} does not match configured ${input.dimensions}`,
            );
          }
          vectors.push(item.embedding);
        }
      }
      return vectors;
    },
  };
}
