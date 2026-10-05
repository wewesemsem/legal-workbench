export type LegalDocumentType =
  | "CONSTITUTION"
  | "LEGISLATION"
  | "REGULATION"
  | "JUDGMENT"
  | "JUDGMENT_SUMMARY"
  | "CONSTITUTIONAL_JUDGMENT"
  | "LEGISLATIVE_HISTORY"
  | "PARLIAMENTARY_DOCUMENT"
  | "OFFICIAL_DECISION"
  | "HISTORICAL_LEGAL_MATERIAL"
  | "OTHER";

export type LegalAuthorityStatus =
  | "AUTHORITATIVE_SOURCE"
  | "DERIVED"
  | "FIXTURE"
  | "UNVERIFIED";

export type LegalAcquisitionMethod =
  | "OFFICIAL_DOWNLOAD"
  | "OFFICIAL_API"
  | "OFFICIAL_PUBLIC_WEB"
  | "LICENSED_DATASET"
  | "AUTHORIZED_MANUAL_IMPORT"
  | "PUBLIC_DOCUMENT"
  | "FUTURE_CONNECTOR"
  | "FIXTURE";

export type LegalReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type LegalTextOrigin =
  | "SOURCE_TEXT"
  | "OCR"
  | "SUMMARY"
  | "METADATA"
  | "DERIVED_TRANSLATION"
  | "FIXTURE";

export type LegalProvisionType =
  | "DOCUMENT"
  | "BOOK"
  | "PART"
  | "TITLE"
  | "CHAPTER"
  | "SECTION"
  | "ARTICLE"
  | "PARAGRAPH"
  | "CLAUSE"
  | "OTHER";

export type LegalErrorCategory =
  | "NETWORK_ERROR"
  | "ACCESS_RESTRICTED"
  | "PARSE_ERROR"
  | "INVALID_CONTENT"
  | "OCR_ERROR"
  | "DUPLICATE"
  | "UNKNOWN";

export type DiscoveredDocument = {
  sourceUrl: string;
  title?: string;
  documentType: LegalDocumentType;
  externalId?: string;
  metadata?: Record<string, unknown>;
};

export type FetchedDocument = {
  sourceUrl: string;
  externalId?: string;
  title: string;
  documentType: LegalDocumentType;
  contentType: string;
  rawBytes: Buffer;
  text?: string;
  textOrigin: LegalTextOrigin;
  authorityStatus?: LegalAuthorityStatus;
  acquisitionMethod?: LegalAcquisitionMethod;
  acquisitionNote?: string;
  reviewStatus?: LegalReviewStatus;
  metadata?: Record<string, unknown>;
  accessRestricted?: boolean;
  errorCategory?: LegalErrorCategory;
  errorMessage?: string;
};

export type ParsedProvision = {
  provisionType: LegalProvisionType;
  provisionNumber?: string;
  heading?: string;
  text: string;
  sequence: number;
  pageNumber?: number;
  textOrigin: LegalTextOrigin;
  children?: ParsedProvision[];
  metadata?: Record<string, unknown>;
};

export type ParsedLegalDocument = {
  title: string;
  documentType: LegalDocumentType;
  documentNumber?: string;
  year?: number;
  issuingAuthority: string;
  publicationDate?: string;
  effectiveDate?: string;
  expirationDate?: string;
  language: string;
  textOrigin: LegalTextOrigin;
  authorityStatus?: LegalAuthorityStatus;
  acquisitionMethod?: LegalAcquisitionMethod;
  acquisitionNote?: string;
  reviewStatus?: LegalReviewStatus;
  normalizedText: string;
  provisions: ParsedProvision[];
  metadata?: Record<string, unknown>;
};

export interface LegalSourceAdapter {
  readonly key: string;
  discover(input?: { limit?: number }): Promise<DiscoveredDocument[]>;
  fetch(discovered: DiscoveredDocument): Promise<FetchedDocument>;
  parse(fetched: FetchedDocument): Promise<ParsedLegalDocument>;
}
