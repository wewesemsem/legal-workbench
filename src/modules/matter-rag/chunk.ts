import { createHash } from "node:crypto";

const DEFAULT_MAX_CHARS = 1_200;
const OVERLAP = 120;

export type MatterTextChunk = {
  pageNumber: number;
  pageId: string | null;
  chunkIndex: number;
  text: string;
  contentHash: string;
};

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Split page text into overlapping chunks while preserving page provenance.
 */
export function chunkPageText(input: {
  pageNumber: number;
  pageId: string | null;
  text: string;
  maxChars?: number;
}): MatterTextChunk[] {
  const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!text) {
    return [];
  }

  if (text.length <= maxChars) {
    return [
      {
        pageNumber: input.pageNumber,
        pageId: input.pageId,
        chunkIndex: 0,
        text,
        contentHash: hashText(text),
      },
    ];
  }

  const chunks: MatterTextChunk[] = [];
  let start = 0;
  let chunkIndex = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const pivot = text.lastIndexOf(" ", end);
      if (pivot > start + Math.floor(maxChars * 0.5)) {
        end = pivot;
      }
    }
    const slice = text.slice(start, end).trim();
    if (slice) {
      chunks.push({
        pageNumber: input.pageNumber,
        pageId: input.pageId,
        chunkIndex,
        text: slice,
        contentHash: hashText(slice),
      });
      chunkIndex += 1;
    }
    if (end >= text.length) break;
    start = Math.max(0, end - OVERLAP);
  }
  return chunks;
}
