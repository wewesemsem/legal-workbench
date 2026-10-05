import { createHash } from "node:crypto";

import { LEGAL_VECTOR_DIMENSIONS } from "@/lib/db/schema/vector";
import type { EmbeddingProvider } from "@/modules/legal-retrieval/embeddings/types";

export function embedWithHash(text: string, dimensions = LEGAL_VECTOR_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = text.toLowerCase().match(/\p{L}[\p{L}\p{N}]{1,}/gu) ?? [];
  if (tokens.length === 0) {
    vector[0] = 1;
    return vector;
  }

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    const index = digest.readUInt32BE(0) % dimensions;
    const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }

  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (!norm) {
    vector[0] = 1;
    return vector;
  }
  return vector.map((value) => value / norm);
}

export function createHashEmbeddingProvider(input: {
  model: string;
  dimensions: number;
}): EmbeddingProvider {
  return {
    id: "mock",
    model: input.model,
    dimensions: input.dimensions,
    async embed(texts) {
      return texts.map((text) => embedWithHash(text, input.dimensions));
    },
  };
}
