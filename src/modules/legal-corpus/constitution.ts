import { normalizeLegalText } from "@/modules/legal-corpus/normalize";
import type {
  ParsedLegalDocument,
  ParsedProvision,
} from "@/modules/legal-corpus/types";

export type ConstitutionArticle = {
  number: string;
  text: string;
  bab?: string;
  chapter?: string;
  section?: string;
  label?: string;
};

export type ConstitutionSnapshot = {
  sourceUrl: string;
  retrievedAt: string;
  hostname: string;
  title: string;
  preamble?: string;
  articles: ConstitutionArticle[];
  rawHtmlHash?: string;
  robotsNote?: string;
};

function structuralNode(
  provisionType: ParsedProvision["provisionType"],
  heading: string,
  sequence: number,
  kind: string,
): ParsedProvision {
  return {
    provisionType,
    heading,
    text: heading,
    sequence,
    textOrigin: "SOURCE_TEXT",
    children: [],
    metadata: { kind },
  };
}

export function buildConstitutionProvisions(
  snapshot: ConstitutionSnapshot,
): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];
  let sequence = 1;

  if (snapshot.preamble?.trim()) {
    provisions.push({
      provisionType: "OTHER",
      provisionNumber: "preamble",
      heading: "ديباجة",
      text: snapshot.preamble.trim(),
      sequence: sequence++,
      textOrigin: "SOURCE_TEXT",
      metadata: { kind: "preamble" },
    });
  }

  let currentPart: ParsedProvision | null = null;
  let currentChapter: ParsedProvision | null = null;
  let currentSection: ParsedProvision | null = null;

  for (const article of snapshot.articles) {
    if (article.bab?.trim() && article.bab !== currentPart?.heading) {
      currentPart = structuralNode("PART", article.bab.trim(), sequence++, "bab");
      currentChapter = null;
      currentSection = null;
      provisions.push(currentPart);
    }
    if (article.chapter?.trim() && article.chapter !== currentChapter?.heading) {
      currentChapter = structuralNode(
        "CHAPTER",
        article.chapter.trim(),
        sequence++,
        "chapter",
      );
      currentSection = null;
      (currentPart?.children ?? provisions).push(currentChapter);
    }
    if (article.section?.trim() && article.section !== currentSection?.heading) {
      currentSection = structuralNode(
        "SECTION",
        article.section.trim(),
        sequence++,
        "section",
      );
      const sectionParent = currentChapter ?? currentPart;
      (sectionParent?.children ?? provisions).push(currentSection);
    }

    const paragraphs = article.text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
    const articleNode: ParsedProvision = {
      provisionType: "ARTICLE",
      provisionNumber: article.number,
      heading: article.label || `المادة ${article.number}`,
      text: article.text,
      sequence: sequence++,
      textOrigin: "SOURCE_TEXT",
      children:
        paragraphs.length > 1
          ? paragraphs.map((text, index) => ({
              provisionType: "PARAGRAPH" as const,
              provisionNumber: String(index + 1),
              text,
              sequence: index + 1,
              textOrigin: "SOURCE_TEXT" as const,
            }))
          : undefined,
      metadata: {
        article_number: article.number,
        bab: article.bab,
        chapter: article.chapter,
        section: article.section,
        source_url: snapshot.sourceUrl,
      },
    };
    const articleParent = currentSection ?? currentChapter ?? currentPart;
    if (articleParent) {
      articleParent.children = articleParent.children ?? [];
      articleParent.children.push(articleNode);
    } else {
      provisions.push(articleNode);
    }
  }

  return provisions;
}

export function parseConstitutionSnapshot(
  snapshot: ConstitutionSnapshot,
): ParsedLegalDocument {
  if (!snapshot.articles.length) {
    throw new Error("INVALID_CONTENT: Constitution snapshot has no articles");
  }

  const articleTexts = snapshot.articles
    .map(
      (article) =>
        `${article.label || `المادة ${article.number}`}\n${article.text}`,
    )
    .join("\n\n");
  const normalizedText = normalizeLegalText(
    [snapshot.preamble ?? "", articleTexts].filter(Boolean).join("\n\n"),
  );

  return {
    title: snapshot.title,
    documentType: "CONSTITUTION",
    issuingAuthority: "Egyptian Parliament",
    language: "ar",
    textOrigin: "SOURCE_TEXT",
    authorityStatus: "AUTHORITATIVE_SOURCE",
    acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
    acquisitionNote:
      "Fetched from the official Egyptian Parliament public Constitution page",
    reviewStatus: "PENDING_REVIEW",
    year: 2014,
    normalizedText,
    provisions: buildConstitutionProvisions(snapshot),
    metadata: {
      country: "EG",
      jurisdiction: "NATIONAL",
      authority: "Egyptian Parliament",
      document_type: "CONSTITUTION",
      document_title_ar: snapshot.title,
      language: "ar",
      authority_status: "AUTHORITATIVE_SOURCE",
      content_type: "SOURCE_TEXT",
      acquisition_method: "OFFICIAL_PUBLIC_WEB",
      source_url: snapshot.sourceUrl,
      hostname: snapshot.hostname,
      retrieved_at: snapshot.retrievedAt,
      article_count: snapshot.articles.length,
      robots_note: snapshot.robotsNote,
    },
  };
}

export function formatConstitutionValidationReport(input: {
  sourceName: string;
  sourceUrl: string;
  authority: string;
  language: string;
  documents: number;
  articles: number;
  chunks: number;
  authorityStatus: string;
  contentType: string;
  status: string;
  note?: string;
}) {
  return `Egyptian Constitution Import
----------------------------

Source:
${input.sourceName}

URL:
${input.sourceUrl}

Authority:
${input.authority}

Language:
${input.language}

Documents:
${input.documents}

Articles:
${input.articles}

Chunks:
${input.chunks}

Authority:
${input.authorityStatus}

Content:
${input.contentType}

Status:
${input.status}${input.note ? `\n\nNote:\n${input.note}` : ""}
`;
}
