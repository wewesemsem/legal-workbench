export interface EmbeddingProvider {
  readonly id: "mock" | "openai";
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
