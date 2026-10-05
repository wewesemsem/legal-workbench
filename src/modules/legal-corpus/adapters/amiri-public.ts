import { OfficialPublicWebAdapter } from "@/modules/legal-corpus/adapters/official-web";
import type {
  DiscoveredDocument,
  FetchedDocument,
  ParsedLegalDocument,
} from "@/modules/legal-corpus/types";
import { parseLegalSourceText } from "@/modules/legal-corpus/parse";

const AMIRI_HOME = "http://alamiria.com/Sec/Home";
const AMIRI_ALLOWED = ["alamiria.com"];

/**
 * Amiri Press / Official Gazette public adapter.
 * Discovers publicly reachable pages; records ACCESS_RESTRICTED when login/subscription walls appear.
 * Does not fabricate bulk legislative access.
 */
export class AmiriPressPublicAdapter extends OfficialPublicWebAdapter {
  constructor() {
    super({
      key: "egypt-amiri",
      allowedHosts: AMIRI_ALLOWED,
      origin: "http://alamiria.com",
      defaultDocumentType: "LEGISLATION",
    });
  }

  async discover(): Promise<DiscoveredDocument[]> {
    const robots = await this.robots();
    const candidate: DiscoveredDocument = {
      sourceUrl: AMIRI_HOME,
      title: "Egyptian Amiri Press / Official Legislation portal",
      documentType: "LEGISLATION",
      externalId: "amiri-home",
      metadata: {
        robots_note: robots.note,
      },
    };

    if (robots.disallowsAll) {
      return [
        {
          ...candidate,
          metadata: {
            ...candidate.metadata,
            accessRestricted: true,
            reason: robots.note,
            accessStatus: "ACCESS_RESTRICTED",
          },
        },
      ];
    }

    try {
      const response = await this.get(AMIRI_HOME);
      const body = await response.text();
      const restriction = this.evaluateResponse(
        response.status,
        body,
        response.url,
      );
      if (restriction.restricted) {
        return [
          {
            ...candidate,
            metadata: {
              ...candidate.metadata,
              accessRestricted: true,
              reason: restriction.reason,
              accessStatus: restriction.accessStatus,
            },
          },
        ];
      }

      // Portal is reachable but typically login-gated for legislative text.
      if (
        /تسجيل الدخول|login|اشتراك|subscription/i.test(body) ||
        !/المادة\s*\d+|قانون\s*رقم/.test(body)
      ) {
        return [
          {
            ...candidate,
            metadata: {
              ...candidate.metadata,
              accessRestricted: true,
              reason:
                "Portal homepage publicly reachable, but enacted legislative source text is not available without authentication/subscription; no bypass attempted",
              accessStatus: "AUTHENTICATION_REQUIRED",
              discovery: {
                publicly_accessible_homepage: true,
                legislation_text_publicly_retrievable: false,
              },
            },
          },
        ];
      }

      return [
        {
          ...candidate,
          metadata: {
            ...candidate.metadata,
            acquisition_method: "OFFICIAL_PUBLIC_WEB",
            authority_status: "AUTHORITATIVE_SOURCE",
          },
        },
      ];
    } catch (error) {
      return [
        {
          ...candidate,
          metadata: {
            ...candidate.metadata,
            accessRestricted: true,
            reason: error instanceof Error ? error.message : "ERROR",
            accessStatus: "ERROR",
          },
        },
      ];
    }
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
    return {
      sourceUrl: discovered.sourceUrl,
      externalId: discovered.externalId,
      title: discovered.title || "Amiri Press document",
      documentType: "LEGISLATION",
      contentType: "text/html",
      rawBytes: Buffer.from(body, "utf8"),
      text: body,
      textOrigin: "SOURCE_TEXT",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
      reviewStatus: "PENDING_REVIEW",
    };
  }

  async parse(fetched: FetchedDocument): Promise<ParsedLegalDocument> {
    if (fetched.accessRestricted || !fetched.text) {
      throw new Error(fetched.errorMessage || "ACCESS_RESTRICTED");
    }
    return parseLegalSourceText(fetched);
  }
}

export function createAmiriPressPublicAdapter() {
  return new AmiriPressPublicAdapter();
}
