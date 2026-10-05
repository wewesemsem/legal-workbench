import { OfficialPublicWebAdapter } from "@/modules/legal-corpus/adapters/official-web";
import { normalizeLegalText } from "@/modules/legal-corpus/normalize";
import type {
  DiscoveredDocument,
  FetchedDocument,
  ParsedLegalDocument,
} from "@/modules/legal-corpus/types";

const SCC_HOME = "https://www.sccourt.gov.eg/";
const SCC_ALLOWED = ["sccourt.gov.eg"];

/**
 * Conservative SCC public adapter.
 * Ingests only clearly public HTML text; classifies summaries vs source text;
 * records ACCESS_RESTRICTED when pages require auth/JS-only shells without text.
 */
export class SccPublicAdapter extends OfficialPublicWebAdapter {
  constructor() {
    super({
      key: "egypt-scc",
      allowedHosts: SCC_ALLOWED,
      origin: SCC_HOME,
      defaultDocumentType: "JUDGMENT",
    });
  }

  async discover(input?: { limit?: number }): Promise<DiscoveredDocument[]> {
    const robots = await this.robots();
    const limit = input?.limit ?? 5;
    const candidates = [
      {
        sourceUrl: "https://www.sccourt.gov.eg/newportal/",
        title: "Supreme Constitutional Court portal",
        documentType: "JUDGMENT" as const,
        externalId: "scc-newportal-home",
      },
      {
        sourceUrl: "https://www.sccourt.gov.eg/SCC/?a=cp3&id=802",
        title: "SCC public constitutional materials",
        documentType: "CONSTITUTIONAL_JUDGMENT" as const,
        externalId: "scc-cp3-802",
      },
    ].slice(0, limit);

    if (robots.disallowsAll) {
      return candidates.map((item) => ({
        ...item,
        metadata: {
          accessRestricted: true,
          reason: robots.note,
          accessStatus: "ACCESS_RESTRICTED",
        },
      }));
    }

    const discovered: DiscoveredDocument[] = [];
    for (const candidate of candidates) {
      try {
        this.assertUrl(candidate.sourceUrl);
        const response = await this.get(candidate.sourceUrl);
        const body = await response.text();
        const restriction = this.evaluateResponse(
          response.status,
          body,
          response.url,
        );
        if (restriction.restricted) {
          discovered.push({
            ...candidate,
            metadata: {
              accessRestricted: true,
              reason: restriction.reason,
              accessStatus: restriction.accessStatus,
            },
          });
          continue;
        }

        const text = stripHtml(body);
        const looksSummary = /ملخص\s*الحكم|summary/i.test(text);
        const hasLegalBody =
          text.length > 400 &&
          /حكم|دستوري|المحكمة|قضية|طعن/.test(text) &&
          !/تتطلب متصفحًا مدعومًا بجافا اسكربت|requires?\s+javascript/i.test(
            text,
          );

        if (!hasLegalBody) {
          discovered.push({
            ...candidate,
            metadata: {
              accessRestricted: true,
              reason:
                "Public page retrieved but no extractable judgment/source text without authentication or richer client rendering",
              accessStatus: "ACCESS_RESTRICTED",
              robots_note: robots.note,
            },
          });
          continue;
        }

        discovered.push({
          ...candidate,
          documentType: looksSummary ? "JUDGMENT_SUMMARY" : candidate.documentType,
          metadata: {
            content_type: looksSummary ? "SUMMARY" : "SOURCE_TEXT",
            robots_note: robots.note,
            acquisition_method: "OFFICIAL_PUBLIC_WEB",
            authority_status: "AUTHORITATIVE_SOURCE",
            text_preview_len: text.length,
          },
        });
      } catch (error) {
        discovered.push({
          ...candidate,
          metadata: {
            accessRestricted: true,
            reason: error instanceof Error ? error.message : "ERROR",
            accessStatus: "ERROR",
          },
        });
      }
    }
    return discovered;
  }

  async fetch(discovered: DiscoveredDocument): Promise<FetchedDocument> {
    if (discovered.metadata?.accessRestricted) {
      return this.restrictedFetch(
        discovered,
        String(discovered.metadata.reason ?? "ACCESS_RESTRICTED"),
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

    const text = stripHtml(body);
    const looksSummary =
      discovered.documentType === "JUDGMENT_SUMMARY" ||
      /ملخص\s*الحكم|summary/i.test(text);

    return {
      sourceUrl: discovered.sourceUrl,
      externalId: discovered.externalId,
      title: discovered.title || "SCC public material",
      documentType: looksSummary ? "JUDGMENT_SUMMARY" : discovered.documentType,
      contentType: "text/html",
      rawBytes: Buffer.from(body, "utf8"),
      text,
      textOrigin: looksSummary ? "SUMMARY" : "SOURCE_TEXT",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
      acquisitionNote: "Official public web acquisition from sccourt.gov.eg",
      reviewStatus: "PENDING_REVIEW",
      metadata: {
        content_type: looksSummary ? "SUMMARY" : "SOURCE_TEXT",
        hostname: this.assertUrl(discovered.sourceUrl),
      },
    };
  }

  async parse(fetched: FetchedDocument): Promise<ParsedLegalDocument> {
    if (fetched.accessRestricted || !fetched.text) {
      throw new Error(fetched.errorMessage || "ACCESS_RESTRICTED");
    }
    const normalizedText = normalizeLegalText(fetched.text);
    return {
      title: fetched.title,
      documentType: fetched.documentType,
      issuingAuthority: "Supreme Constitutional Court",
      language: "ar",
      textOrigin: fetched.textOrigin,
      authorityStatus: "AUTHORITATIVE_SOURCE",
      acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
      reviewStatus: "PENDING_REVIEW",
      normalizedText,
      provisions: [
        {
          provisionType: "DOCUMENT",
          heading: fetched.title,
          text: normalizedText,
          sequence: 1,
          textOrigin: fetched.textOrigin,
        },
      ],
      metadata: fetched.metadata,
    };
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createSccPublicAdapter() {
  return new SccPublicAdapter();
}
