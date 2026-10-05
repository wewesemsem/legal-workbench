import { z } from "zod";

export const AUTHORITY_STATUSES = [
  "AUTHORITATIVE_SOURCE",
  "DERIVED",
  "FIXTURE",
  "UNVERIFIED",
] as const;

export const ACQUISITION_METHODS = [
  "OFFICIAL_DOWNLOAD",
  "OFFICIAL_API",
  "OFFICIAL_PUBLIC_WEB",
  "LICENSED_DATASET",
  "AUTHORIZED_MANUAL_IMPORT",
  "PUBLIC_DOCUMENT",
  "FUTURE_CONNECTOR",
  "FIXTURE",
] as const;

export const CONTENT_TYPES = [
  "SOURCE_TEXT",
  "OCR",
  "SUMMARY",
  "METADATA",
  "DERIVED_TRANSLATION",
  "FIXTURE",
] as const;

export const MANIFEST_DOCUMENT_TYPES = [
  "LAW",
  "CONSTITUTION",
  "LEGISLATION",
  "REGULATION",
  "JUDGMENT",
  "JUDGMENT_SUMMARY",
  "CONSTITUTIONAL_JUDGMENT",
  "LEGISLATIVE_HISTORY",
  "PARLIAMENTARY_DOCUMENT",
  "OFFICIAL_DECISION",
  "DECREE",
  "HISTORICAL_LEGAL_MATERIAL",
  "OTHER",
] as const;

export const importManifestSchema = z.object({
  source_id: z.string().trim().min(1).optional(),
  source_name: z.string().trim().min(1),
  source_type: z
    .enum(["OFFICIAL", "JUDICIAL", "LEGISLATIVE", "LICENSED", "OTHER"])
    .default("OFFICIAL"),
  authority_status: z.enum(AUTHORITY_STATUSES),
  acquisition_method: z.enum(ACQUISITION_METHODS),
  acquisition_note: z.string().trim().min(1).max(4_000).optional(),
  country: z.string().trim().min(2).default("EG"),
  jurisdiction: z.string().trim().min(1).default("Egypt"),
  source_url: z.string().url().optional().nullable(),
  issuing_authority: z.string().trim().min(1).optional(),
  documents: z
    .array(
      z.object({
        file: z.string().trim().min(1),
        /** Optional companion extract for PDF/image originals. */
        text_file: z.string().trim().min(1).optional(),
        title: z.string().trim().min(1),
        document_number: z.string().trim().optional().nullable(),
        year: z.number().int().min(1800).max(2100).optional().nullable(),
        document_type: z.enum(MANIFEST_DOCUMENT_TYPES),
        language: z.string().trim().min(2).default("ar"),
        issuing_authority: z.string().trim().min(1),
        publication_date: z.string().trim().optional().nullable(),
        effective_date: z.string().trim().optional().nullable(),
        expiration_date: z.string().trim().optional().nullable(),
        content_type: z.enum(CONTENT_TYPES),
        source_url: z.string().url().optional().nullable(),
        external_id: z.string().trim().optional().nullable(),
        acquisition_note: z.string().trim().max(4_000).optional().nullable(),
        page_number: z.number().int().positive().optional().nullable(),
      }),
    )
    .min(1),
});

export type ImportManifest = z.infer<typeof importManifestSchema>;

export function mapManifestDocumentType(
  value: (typeof MANIFEST_DOCUMENT_TYPES)[number],
) {
  switch (value) {
    case "LAW":
      return "LEGISLATION" as const;
    case "DECREE":
      return "OFFICIAL_DECISION" as const;
    default:
      return value;
  }
}

export function mapManifestSourceType(
  value: ImportManifest["source_type"],
): "LEGISLATION" | "JUDICIAL" | "LEGISLATIVE" | "OTHER" {
  switch (value) {
    case "OFFICIAL":
      return "LEGISLATION";
    case "JUDICIAL":
      return "JUDICIAL";
    case "LEGISLATIVE":
      return "LEGISLATIVE";
    default:
      return "OTHER";
  }
}
