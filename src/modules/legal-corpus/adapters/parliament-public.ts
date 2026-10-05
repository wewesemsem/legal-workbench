import { OfficialPublicWebAdapter } from "@/modules/legal-corpus/adapters/official-web";
import type {
  DiscoveredDocument,
  FetchedDocument,
  LegalDocumentType,
  ParsedLegalDocument,
} from "@/modules/legal-corpus/types";
import { parseLegalSourceText } from "@/modules/legal-corpus/parse";

const PARLIAMENT_ORIGIN = "https://parliament.gov.eg";
const ALLOWED = ["parliament.gov.eg"];

type Candidate = {
  path: string;
  title: string;
  documentType: LegalDocumentType;
  externalId: string;
  classificationNote: string;
};

const CANDIDATES: Candidate[] = [
  {
    path: "/Constitution.aspx",
    title: "الدستور",
    documentType: "CONSTITUTION",
    externalId: "parliament-constitution-link",
    classificationNote: "Constitutional text page (see dedicated constitution adapter for structured ingest)",
  },
  {
    path: "/InternalRegulation.aspx",
    title: "اللائحة الداخلية",
    documentType: "PARLIAMENTARY_DOCUMENT",
    externalId: "parliament-internal-regulation",
    classificationNote: "Parliamentary internal regulation — not enacted general legislation",
  },
  {
    path: "/Parliament_Reports_main.aspx?flag=5",
    title: "مجلة البرلمان",
    documentType: "PARLIAMENTARY_DOCUMENT",
    externalId: "parliament-magazine",
    classificationNote: "Parliamentary magazine/material — not enacted law",
  },
  {
    path: "/SESSIONS_SHOW.aspx",
    title: "جدول أعمال الجلسات",
    documentType: "LEGISLATIVE_HISTORY",
    externalId: "parliament-sessions",
    classificationNote: "Session agenda / legislative process material — not enacted law",
  },
];

/**
 * Broader Parliament public discovery.
 * Does not treat bills/agendas/commentary as enacted law.
 */
export class ParliamentPublicAdapter extends OfficialPublicWebAdapter {
  constructor() {
    super({
      key: "egypt-parliament",
      allowedHosts: ALLOWED,
      relaxTlsForHosts: ALLOWED,
      origin: PARLIAMENT_ORIGIN,
      defaultDocumentType: "PARLIAMENTARY_DOCUMENT",
    });
  }

  async discover(input?: { limit?: number }): Promise<DiscoveredDocument[]> {
    const robots = await this.robots();
    const limit = input?.limit ?? CANDIDATES.length;
    const discovered: DiscoveredDocument[] = [];

    for (const candidate of CANDIDATES.slice(0, limit)) {
      const sourceUrl = `${PARLIAMENT_ORIGIN}${candidate.path}`;
      if (robots.disallowsAll) {
        discovered.push({
          sourceUrl,
          title: candidate.title,
          documentType: candidate.documentType,
          externalId: candidate.externalId,
          metadata: {
            accessRestricted: true,
            reason: robots.note,
            classification_note: candidate.classificationNote,
          },
        });
        continue;
      }

      try {
        const response = await this.get(sourceUrl);
        const body = await response.text();
        const restriction = this.evaluateResponse(
          response.status,
          body,
          response.url,
        );
        if (restriction.restricted) {
          discovered.push({
            sourceUrl,
            title: candidate.title,
            documentType: candidate.documentType,
            externalId: candidate.externalId,
            metadata: {
              accessRestricted: true,
              reason: restriction.reason,
              accessStatus: restriction.accessStatus,
              classification_note: candidate.classificationNote,
            },
          });
          continue;
        }

        discovered.push({
          sourceUrl,
          title: candidate.title,
          documentType: candidate.documentType,
          externalId: candidate.externalId,
          metadata: {
            classification_note: candidate.classificationNote,
            acquisition_method: "OFFICIAL_PUBLIC_WEB",
            publicly_accessible: true,
            // Structured constitution ingest is handled by egypt-parliament-constitution.
            skip_structured_ingest: candidate.documentType === "CONSTITUTION",
          },
        });
      } catch (error) {
        discovered.push({
          sourceUrl,
          title: candidate.title,
          documentType: candidate.documentType,
          externalId: candidate.externalId,
          metadata: {
            accessRestricted: true,
            reason: error instanceof Error ? error.message : "ERROR",
            classification_note: candidate.classificationNote,
          },
        });
      }
    }

    return discovered;
  }

  async fetch(discovered: DiscoveredDocument): Promise<FetchedDocument> {
    if (
      discovered.metadata?.accessRestricted ||
      discovered.metadata?.skip_structured_ingest
    ) {
      return this.restrictedFetch(
        discovered,
        String(
          discovered.metadata?.reason ??
            "Discovery-only item; use egypt-parliament-constitution for Constitution text",
        ),
      );
    }

    const response = await this.get(discovered.sourceUrl);
    const body = await response.text();
    const restriction = this.evaluateResponse(
      response.status,
      body,
      response.url,
    );
    if (restriction.restricted) {
      return this.restrictedFetch(
        discovered,
        restriction.reason || "ACCESS_RESTRICTED",
      );
    }

    // Parliamentary materials are provenance-tracked but not treated as enacted law.
    return {
      sourceUrl: discovered.sourceUrl,
      externalId: discovered.externalId,
      title: discovered.title || "Parliamentary material",
      documentType: discovered.documentType,
      contentType: "text/html",
      rawBytes: Buffer.from(body, "utf8"),
      text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      textOrigin:
        discovered.documentType === "LEGISLATIVE_HISTORY"
          ? "METADATA"
          : "SOURCE_TEXT",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
      reviewStatus: "PENDING_REVIEW",
      metadata: discovered.metadata,
    };
  }

  async parse(fetched: FetchedDocument): Promise<ParsedLegalDocument> {
    if (fetched.accessRestricted || !fetched.text) {
      throw new Error(fetched.errorMessage || "ACCESS_RESTRICTED");
    }
    const parsed = parseLegalSourceText(fetched);
    return {
      ...parsed,
      documentType: fetched.documentType,
      issuingAuthority: "Egyptian Parliament",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
      reviewStatus: "PENDING_REVIEW",
    };
  }
}

export function createParliamentPublicAdapter() {
  return new ParliamentPublicAdapter();
}
