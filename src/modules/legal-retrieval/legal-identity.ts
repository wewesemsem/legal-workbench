import { westernDigits } from "@/modules/legal-corpus/hierarchy";
import type { LegalDocumentType } from "@/modules/legal-corpus/types";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";

/**
 * Administrative-level jurisdiction labels stored on corpus rows.
 * These are not country codes — prefer `country` when present.
 */
const ADMIN_JURISDICTION_LABELS = new Set([
  "NATIONAL",
  "FEDERAL",
  "STATE",
  "PROVINCIAL",
  "LOCAL",
  "MUNICIPAL",
  "REGIONAL",
]);

/** Deterministic aliases for instruments the workbench currently indexes. */
const DOCUMENT_ALIASES: Array<{
  id: string;
  jurisdiction: string;
  documentType: LegalDocumentType;
  patterns: RegExp[];
}> = [
  {
    id: "egypt_constitution",
    jurisdiction: "EG",
    documentType: "CONSTITUTION",
    patterns: [
      /egyptian\s+constitution/i,
      /egypt(?:ian)?\s+constitution/i,
      /constitution\s+of\s+(?:the\s+)?(?:arab\s+republic\s+of\s+)?egypt/i,
      /دستور\s*(?:جمهورية\s*)?مصر(?:\s*العربية)?/i,
      /الدستور\s*المصري/i,
      /دستور\s*جمهورية\s*مصر\s*العربية/i,
    ],
  },
];

export type CanonicalLegalIdentity = {
  documentId: string | null;
  jurisdiction: string | null;
  articleNumber: string | null;
  documentType?: LegalDocumentType;
};

export function normalizeJurisdictionCode(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const folded = value.trim().toLowerCase();
  if (!folded) return null;
  if (
    folded === "eg" ||
    folded === "egypt" ||
    folded.includes("egypt") ||
    folded.includes("مصر")
  ) {
    return "EG";
  }
  if (
    folded === "us" ||
    folded === "usa" ||
    folded.includes("united states") ||
    folded.includes("american")
  ) {
    return "US";
  }
  return folded.toUpperCase();
}

/**
 * Resolve the country-level jurisdiction for evidence.
 * Corpus constitution rows store jurisdiction="NATIONAL" and country="EG".
 */
export function evidenceJurisdictionCode(evidence: {
  jurisdiction?: string | null;
  country?: string | null;
}): string | null {
  const rawJurisdiction = evidence.jurisdiction?.trim() ?? "";
  const asCode = normalizeJurisdictionCode(rawJurisdiction);
  if (asCode && !ADMIN_JURISDICTION_LABELS.has(asCode)) {
    return asCode;
  }
  const fromCountry = normalizeJurisdictionCode(evidence.country);
  if (fromCountry) return fromCountry;
  return asCode;
}

export function normalizeArticleNumber(
  value: string | number | null | undefined,
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const western = westernDigits(raw);
  const labeled = western.match(
    /(?:article|art\.?|المادة|ماده)\s*(?:رقم\s*)?([0-9]+)/i,
  );
  if (labeled?.[1]) return String(Number(labeled[1]));

  const bare = western.match(/^([0-9]+)$/);
  if (bare?.[1]) return String(Number(bare[1]));

  const embedded = western.match(/([0-9]+)/);
  if (embedded?.[1]) return String(Number(embedded[1]));

  return null;
}

export function canonicalDocumentIdFromLabel(
  label: string | null | undefined,
  hints: {
    jurisdiction?: string | null;
    documentType?: LegalDocumentType | string | null;
  } = {},
): string | null {
  if (!label?.trim()) return null;
  const jurisdiction = normalizeJurisdictionCode(hints.jurisdiction);
  for (const alias of DOCUMENT_ALIASES) {
    if (!alias.patterns.some((pattern) => pattern.test(label))) continue;
    if (
      jurisdiction &&
      alias.jurisdiction &&
      jurisdiction !== alias.jurisdiction
    ) {
      continue;
    }
    return alias.id;
  }
  return null;
}

export function evidenceDocumentCanonicalId(
  evidence: Pick<
    LegalEvidence,
    "title" | "heading" | "documentType" | "jurisdiction" | "country"
  >,
): string | null {
  const jurisdiction = evidenceJurisdictionCode(evidence);
  const fromTitle = canonicalDocumentIdFromLabel(evidence.title, {
    jurisdiction,
    documentType: evidence.documentType,
  });
  if (fromTitle) return fromTitle;

  const haystack = `${evidence.title} ${evidence.heading ?? ""}`;
  const fromHaystack = canonicalDocumentIdFromLabel(haystack, {
    jurisdiction,
    documentType: evidence.documentType,
  });
  if (fromHaystack) return fromHaystack;

  // Constitution + EG country with Arabic دستور / English constitution wording.
  if (
    evidence.documentType === "CONSTITUTION" &&
    jurisdiction === "EG" &&
    (/دستور/i.test(haystack) || /constitution/i.test(haystack))
  ) {
    return "egypt_constitution";
  }

  return null;
}

export function targetDocumentCanonicalId(target: {
  document?: string | null;
  documentType?: LegalDocumentType | string | null;
  jurisdiction?: string | null;
}): string | null {
  return canonicalDocumentIdFromLabel(target.document, {
    jurisdiction: target.jurisdiction,
    documentType: target.documentType,
  });
}

export function toCanonicalIdentity(input: {
  document?: string | null;
  documentType?: LegalDocumentType | string | null;
  jurisdiction?: string | null;
  country?: string | null;
  articleNumber?: string | number | null;
  title?: string | null;
  heading?: string | null;
}): CanonicalLegalIdentity {
  const jurisdiction =
    evidenceJurisdictionCode({
      jurisdiction: input.jurisdiction,
      country: input.country,
    }) ?? normalizeJurisdictionCode(input.jurisdiction);

  const documentId =
    canonicalDocumentIdFromLabel(input.document ?? input.title, {
      jurisdiction,
      documentType: input.documentType,
    }) ??
    (input.title || input.heading
      ? evidenceDocumentCanonicalId({
          title: input.title ?? input.document ?? "",
          heading: input.heading ?? null,
          documentType: String(input.documentType ?? ""),
          jurisdiction: input.jurisdiction ?? "",
          country: input.country ?? "",
        })
      : null);

  return {
    documentId,
    jurisdiction,
    articleNumber: normalizeArticleNumber(input.articleNumber),
    documentType: input.documentType as LegalDocumentType | undefined,
  };
}
