export type DocumentAiPageResult = {
  pageNumber: number;
  text: string;
  width?: number;
  height?: number;
  layout: {
    paragraphs: string[];
    tables: Array<{ rows: string[][] }>;
    blocks: Array<{ type: string; text: string }>;
  };
  metadata: Record<string, unknown>;
};

export type DocumentAiProcessResult = {
  fullText: string;
  pageCount: number;
  pages: DocumentAiPageResult[];
  provider: "mock" | "google";
  rawSummary: Record<string, unknown>;
};

export interface DocumentAiService {
  processDocument(input: {
    content: Buffer;
    mimeType: string;
    filename: string;
  }): Promise<DocumentAiProcessResult>;
}
