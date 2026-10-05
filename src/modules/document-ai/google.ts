import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

import { getEnv } from "@/lib/env";
import type {
  DocumentAiPageResult,
  DocumentAiProcessResult,
  DocumentAiService,
} from "@/modules/document-ai/types";

function extractAnchorText(fullText: string, textAnchor: unknown) {
  const anchor = textAnchor as
    | {
        textSegments?: Array<{
          startIndex?: unknown;
          endIndex?: unknown;
        }> | null;
      }
    | null
    | undefined;

  const segments = anchor?.textSegments;
  if (!segments?.length) {
    return "";
  }

  return segments
    .map((segment) => {
      const start = Number(segment.startIndex ?? 0);
      const end = Number(segment.endIndex ?? 0);
      return fullText.slice(start, end);
    })
    .join("")
    .trim();
}

export function createGoogleDocumentAiService(): DocumentAiService {
  const env = getEnv();
  const apiEndpoint =
    env.GCP_LOCATION === "us"
      ? "us-documentai.googleapis.com"
      : `${env.GCP_LOCATION}-documentai.googleapis.com`;

  const client = new DocumentProcessorServiceClient({ apiEndpoint });
  const processorName = `projects/${env.GCP_PROJECT_ID}/locations/${env.GCP_LOCATION}/processors/${env.GCP_DOCUMENT_AI_PROCESSOR_ID}`;

  return {
    async processDocument({ content, mimeType }) {
      const [response] = await client.processDocument({
        name: processorName,
        rawDocument: {
          content: content.toString("base64"),
          mimeType,
        },
      });

      const document = response.document;
      const fullText = document?.text ?? "";
      const sourcePages = document?.pages ?? [];

      const pages: DocumentAiPageResult[] = sourcePages.map((page, index) => {
        const pageNumber = page.pageNumber ?? index + 1;
        const paragraphs =
          page.paragraphs
            ?.map((paragraph) =>
              extractAnchorText(fullText, paragraph.layout?.textAnchor),
            )
            .filter(Boolean) ?? [];

        const tables =
          page.tables?.map((table) => {
            const rows =
              table.bodyRows?.map((row) =>
                (row.cells ?? []).map((cell) =>
                  extractAnchorText(fullText, cell.layout?.textAnchor),
                ),
              ) ?? [];
            return { rows };
          }) ?? [];

        const blocks =
          page.blocks?.map((block) => ({
            type: "block",
            text: extractAnchorText(fullText, block.layout?.textAnchor),
          })) ?? [];

        const pageText =
          paragraphs.join("\n\n") ||
          blocks.map((block) => block.text).filter(Boolean).join("\n") ||
          "";

        return {
          pageNumber,
          text: pageText,
          width: page.dimension?.width
            ? Math.round(Number(page.dimension.width))
            : undefined,
          height: page.dimension?.height
            ? Math.round(Number(page.dimension.height))
            : undefined,
          layout: {
            paragraphs,
            tables,
            blocks: blocks.filter((block) => block.text),
          },
          metadata: {
            detectedLanguages: page.detectedLanguages ?? [],
            provider: "google-document-ai",
          },
        };
      });

      const result: DocumentAiProcessResult = {
        fullText: fullText || pages.map((page) => page.text).join("\n\n"),
        pageCount: pages.length || 1,
        pages:
          pages.length > 0
            ? pages
            : [
                {
                  pageNumber: 1,
                  text: fullText,
                  layout: {
                    paragraphs: fullText ? [fullText] : [],
                    tables: [],
                    blocks: [],
                  },
                  metadata: { provider: "google-document-ai" },
                },
              ],
        provider: "google",
        rawSummary: {
          processor: processorName,
          pageCount: pages.length,
          // Do not store full document text in logs/summary.
          hasText: Boolean(fullText),
        },
      };

      return result;
    },
  };
}
