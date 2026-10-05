import { normalizeLegalText } from "@/modules/legal-corpus/normalize";
import type {
  FetchedDocument,
  ParsedLegalDocument,
  ParsedProvision,
  LegalTextOrigin,
} from "@/modules/legal-corpus/types";
import { validationError } from "@/modules/authorization/errors";

const ARTICLE_RE =
  /(?:^|\n)\s*(?:المادة|ماده|Article)\s*([0-9٠-٩]+(?:\s*(?:مكرر|bis))?)\s*[:.\-–—]?\s*/gim;

const CHAPTER_RE =
  /(?:^|\n)\s*(?:الباب|الفصل|Chapter|Book)\s+([^\n]+)/gim;

function westernDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  );
}

function splitParagraphs(
  text: string,
  textOrigin: LegalTextOrigin,
  startSequence: number,
): ParsedProvision[] {
  const parts = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.map((part, index) => ({
    provisionType: "PARAGRAPH" as const,
    provisionNumber: String(index + 1),
    text: part,
    sequence: startSequence + index,
    textOrigin,
  }));
}

/**
 * Deterministic hierarchical parse for Arabic/English legal article structures.
 */
export function parseLegalSourceText(
  fetched: FetchedDocument,
): ParsedLegalDocument {
  const raw = fetched.text ?? fetched.rawBytes.toString("utf8");
  if (!raw.trim()) {
    throw validationError("Invalid content: empty legal text");
  }

  const normalizedText = normalizeLegalText(raw);
  const textOrigin = fetched.textOrigin;
  const provisions: ParsedProvision[] = [];
  let sequence = 1;

  const chapterMatches = [...normalizedText.matchAll(CHAPTER_RE)];
  for (const match of chapterMatches) {
    provisions.push({
      provisionType: "CHAPTER",
      provisionNumber: westernDigits(match[1]?.trim() ?? ""),
      heading: match[0].trim(),
      text: match[0].trim(),
      sequence: sequence++,
      textOrigin,
    });
  }

  const articleMatches = [...normalizedText.matchAll(ARTICLE_RE)];
  if (articleMatches.length === 0) {
    // No articles found — store document body as a single DOCUMENT provision.
    provisions.push({
      provisionType: "DOCUMENT",
      heading: fetched.title,
      text: normalizedText,
      sequence: sequence++,
      textOrigin,
      children: splitParagraphs(normalizedText, textOrigin, 1),
    });
  } else {
    for (let i = 0; i < articleMatches.length; i += 1) {
      const match = articleMatches[i]!;
      const start = match.index ?? 0;
      const end =
        i + 1 < articleMatches.length
          ? (articleMatches[i + 1]!.index ?? normalizedText.length)
          : normalizedText.length;
      const block = normalizedText.slice(start, end).trim();
      const number = westernDigits(match[1] ?? "");
      const withoutHeading = block
        .replace(
          /^\s*(?:المادة|ماده|Article)\s*[0-9٠-٩]+(?:\s*(?:مكرر|bis))?\s*[:.\-–—]?\s*/i,
          "",
        )
        .trim();
      const children = splitParagraphs(withoutHeading || block, textOrigin, 1);

      provisions.push({
        provisionType: "ARTICLE",
        provisionNumber: number,
        heading: `المادة ${number}`,
        text: withoutHeading || block,
        sequence: sequence++,
        textOrigin,
        children,
        metadata: {
          article_number: number,
        },
      });
    }
  }

  const yearMatch = fetched.title.match(/(?:لسنة|of)\s*([0-9٠-٩]{4})/i);
  const numberMatch = fetched.title.match(
    /(?:قانون|Law)\s*(?:رقم|No\.?)?\s*([0-9٠-٩]+)/i,
  );

  return {
    title: fetched.title,
    documentType: fetched.documentType,
    documentNumber: numberMatch
      ? westernDigits(numberMatch[1]!)
      : fetched.externalId,
    year: yearMatch ? Number(westernDigits(yearMatch[1]!)) : undefined,
    issuingAuthority:
      String(fetched.metadata?.issuingAuthority ?? "Unknown authority"),
    publicationDate:
      typeof fetched.metadata?.publicationDate === "string"
        ? fetched.metadata.publicationDate
        : undefined,
    effectiveDate:
      typeof fetched.metadata?.effectiveDate === "string"
        ? fetched.metadata.effectiveDate
        : undefined,
    language: "ar",
    textOrigin,
    normalizedText,
    provisions,
    metadata: fetched.metadata,
  };
}
