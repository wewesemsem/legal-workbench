import { validationError } from "@/modules/authorization/errors";
import type { LegalDocumentType } from "@/modules/legal-corpus/types";
import type {
  LegalSearchFilters,
  ResolvedLegalFilters,
} from "@/modules/legal-retrieval/types";

const DOCUMENT_TYPES = new Set<LegalDocumentType>([
  "CONSTITUTION",
  "LEGISLATION",
  "REGULATION",
  "JUDGMENT",
  "JUDGMENT_SUMMARY",
  "CONSTITUTIONAL_JUDGMENT",
  "LEGISLATIVE_HISTORY",
  "PARLIAMENTARY_DOCUMENT",
  "OFFICIAL_DECISION",
  "HISTORICAL_LEGAL_MATERIAL",
  "OTHER",
]);

function assertSafeToken(value: string, label: string) {
  if (!/^[\p{L}\p{N} _.'()-]{1,120}$/u.test(value)) {
    throw validationError(`Invalid ${label} filter`);
  }
}

export function resolveLegalFilters(
  input?: LegalSearchFilters,
  extra?: { documentNumber?: string; year?: number },
): ResolvedLegalFilters {
  const country = (input?.country ?? "EG").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw validationError("Invalid country filter");
  }
  if (input?.jurisdiction) {
    assertSafeToken(input.jurisdiction, "jurisdiction");
  }
  if (input?.language && !/^[a-z]{2,8}$/i.test(input.language)) {
    throw validationError("Invalid language filter");
  }
  if (input?.documentType && !DOCUMENT_TYPES.has(input.documentType)) {
    throw validationError("Invalid document type filter");
  }
  if (
    input?.legalDocumentId &&
    !/^[A-Za-z0-9_-]{1,80}$/.test(input.legalDocumentId)
  ) {
    throw validationError("Invalid legal document filter");
  }
  if (
    input?.authorityStatus &&
    input.authorityStatus !== "AUTHORITATIVE_SOURCE"
  ) {
    throw validationError("Legal retrieval only allows authoritative sources");
  }
  if (
    input?.contentType &&
    input.contentType !== "SOURCE_TEXT" &&
    input.contentType !== "OCR"
  ) {
    throw validationError("Invalid content type filter");
  }

  return {
    country,
    jurisdiction: input?.jurisdiction,
    language: input?.language?.toLowerCase(),
    documentType: input?.documentType,
    authorityStatus: "AUTHORITATIVE_SOURCE",
    reviewStatus: "APPROVED",
    contentType: input?.contentType,
    legalDocumentId: input?.legalDocumentId,
    documentNumber: extra?.documentNumber,
    year: extra?.year,
  };
}
