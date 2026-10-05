import type { LegalProvisionType } from "@/modules/legal-corpus/types";

const TYPE_LABEL: Record<string, string> = {
  DOCUMENT: "Document",
  BOOK: "Book",
  PART: "Part",
  TITLE: "Title",
  CHAPTER: "Chapter",
  SECTION: "Section",
  ARTICLE: "Article",
  PARAGRAPH: "Paragraph",
  CLAUSE: "Clause",
  OTHER: "Section",
};

export type RetrievalAncestor = {
  provisionType: LegalProvisionType | string;
  heading?: string | null;
  provisionNumber?: string | null;
};

/**
 * Text sent to keyword search and the embedding model.
 * The authoritative source text is appended unchanged.
 */
export function buildRetrievalText(input: {
  documentTitle: string;
  documentType: string;
  ancestors: RetrievalAncestor[];
  provisionType: string;
  provisionNumber?: string | null;
  heading?: string | null;
  sourceText: string;
}): string {
  const lines = [
    `Document: ${input.documentTitle}`,
    `Document type: ${input.documentType}`,
  ];

  for (const ancestor of input.ancestors) {
    const label = TYPE_LABEL[ancestor.provisionType] ?? ancestor.provisionType;
    const value = ancestor.heading?.trim() || ancestor.provisionNumber || "";
    if (value) {
      lines.push(`${label}: ${value}`);
    }
  }

  const selfLabel = TYPE_LABEL[input.provisionType] ?? input.provisionType;
  if (input.provisionNumber) {
    lines.push(`${selfLabel}: ${input.provisionNumber}`);
  }
  if (input.heading?.trim()) {
    lines.push(input.heading.trim());
  }
  if (input.provisionType === "ARTICLE" && input.provisionNumber) {
    lines.push(`article ${input.provisionNumber}`);
    lines.push(`المادة ${input.provisionNumber}`);
  }

  lines.push("");
  lines.push(input.sourceText);
  return lines.join("\n");
}
