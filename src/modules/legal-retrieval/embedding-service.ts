import { LEGAL_VECTOR_DIMENSIONS } from "@/lib/db/schema/vector";
import { getLegalEmbeddingConfig } from "@/modules/legal-retrieval/config";
import { getEmbeddingProvider } from "@/modules/legal-retrieval/embeddings";
import type { EmbeddingProvider } from "@/modules/legal-retrieval/embeddings/types";

export class LegalEmbeddingService {
  constructor(private readonly provider: EmbeddingProvider) {}

  async embedTexts(texts: string[]): Promise<{
    vectors: number[][];
    model: string;
    version: string;
    dimensions: number;
  }> {
    const config = getLegalEmbeddingConfig();
    if (this.provider.dimensions !== LEGAL_VECTOR_DIMENSIONS) {
      throw new Error(
        `Embedding provider width ${this.provider.dimensions} does not match pgvector column ${LEGAL_VECTOR_DIMENSIONS}`,
      );
    }
    if (config.dimensions !== this.provider.dimensions) {
      throw new Error("Embedding configuration does not match the active provider");
    }
    const vectors = texts.length ? await this.provider.embed(texts) : [];
    return {
      vectors,
      model: this.provider.model,
      version: config.version,
      dimensions: this.provider.dimensions,
    };
  }
}

let cached: LegalEmbeddingService | null = null;

export function getLegalEmbeddingService(): LegalEmbeddingService {
  if (!cached) {
    cached = new LegalEmbeddingService(getEmbeddingProvider());
  }
  return cached;
}

export function resetLegalEmbeddingServiceForTests(service?: LegalEmbeddingService) {
  cached = service ?? null;
}
