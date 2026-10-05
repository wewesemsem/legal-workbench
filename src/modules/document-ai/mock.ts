import type {
  DocumentAiProcessResult,
  DocumentAiService,
} from "@/modules/document-ai/types";

/**
 * Deterministic local processor for development/tests.
 * Does not call Google Cloud. Never used when DOCUMENT_AI_PROVIDER=google.
 */
export function createMockDocumentAiService(): DocumentAiService {
  return {
    async processDocument({ content, mimeType, filename }) {
      const isPdf = mimeType === "application/pdf";
      const pageCount = isPdf ? Math.max(1, Math.min(5, Math.ceil(content.length / 50_000))) : 1;
      const pages = Array.from({ length: pageCount }, (_, index) => {
        const pageNumber = index + 1;
        const text = `[Mock OCR] ${filename} — page ${pageNumber}\nExtracted text for testing Matter document isolation.`;
        return {
          pageNumber,
          text,
          width: 2550,
          height: 3300,
          layout: {
            paragraphs: [text],
            tables: [],
            blocks: [{ type: "paragraph", text }],
          },
          metadata: {
            source: "mock-document-ai",
            mimeType,
          },
        };
      });

      const fullText = pages.map((page) => page.text).join("\n\n");
      const result: DocumentAiProcessResult = {
        fullText,
        pageCount,
        pages,
        provider: "mock",
        rawSummary: {
          processor: "mock",
          bytes: content.byteLength,
        },
      };
      return result;
    },
  };
}
