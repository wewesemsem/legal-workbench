import {
  assertAllowedHostname,
  corpusFetch,
  detectAccessRestriction,
  inspectRobotsTxt,
} from "@/modules/legal-corpus/http";
import type {
  DiscoveredDocument,
  FetchedDocument,
  LegalDocumentType,
  LegalSourceAdapter,
  ParsedLegalDocument,
} from "@/modules/legal-corpus/types";
import { parseLegalSourceText } from "@/modules/legal-corpus/parse";

export type OfficialPublicWebAdapterConfig = {
  key: string;
  allowedHosts: string[];
  relaxTlsForHosts?: string[];
  origin: string;
  defaultDocumentType: LegalDocumentType;
};

/**
 * Shared guards for official public-web adapters:
 * domain boundary, robots inspection, access-restriction detection.
 * Never bypasses auth/CAPTCHA/paywalls.
 */
export abstract class OfficialPublicWebAdapter implements LegalSourceAdapter {
  readonly key: string;
  protected readonly allowedHosts: string[];
  protected readonly relaxTlsForHosts: string[];
  protected readonly origin: string;
  protected readonly defaultDocumentType: LegalDocumentType;

  constructor(config: OfficialPublicWebAdapterConfig) {
    this.key = config.key;
    this.allowedHosts = config.allowedHosts;
    this.relaxTlsForHosts = config.relaxTlsForHosts ?? config.allowedHosts;
    this.origin = config.origin;
    this.defaultDocumentType = config.defaultDocumentType;
  }

  protected assertUrl(url: string) {
    return assertAllowedHostname(url, this.allowedHosts);
  }

  protected async get(url: string) {
    this.assertUrl(url);
    return corpusFetch(url, {
      method: "GET",
      relaxTlsForHosts: this.relaxTlsForHosts,
      headers: {
        Referer: this.origin,
      },
    });
  }

  protected async post(url: string, body: string) {
    this.assertUrl(url);
    return corpusFetch(url, {
      method: "POST",
      body,
      relaxTlsForHosts: this.relaxTlsForHosts,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        Origin: this.origin,
        Referer: url,
      },
    });
  }

  protected async robots() {
    return inspectRobotsTxt({
      origin: this.origin,
      allowedHosts: this.allowedHosts,
      relaxTlsForHosts: this.relaxTlsForHosts,
    });
  }

  protected restrictedFetch(
    discovered: DiscoveredDocument,
    reason: string,
  ): FetchedDocument {
    return {
      sourceUrl: discovered.sourceUrl,
      externalId: discovered.externalId,
      title: discovered.title || this.key,
      documentType: discovered.documentType,
      contentType: "text/plain",
      rawBytes: Buffer.from(""),
      textOrigin: "METADATA",
      accessRestricted: true,
      errorCategory: "ACCESS_RESTRICTED",
      errorMessage: reason,
      metadata: discovered.metadata,
    };
  }

  abstract discover(input?: { limit?: number }): Promise<DiscoveredDocument[]>;
  abstract fetch(discovered: DiscoveredDocument): Promise<FetchedDocument>;

  async parse(fetched: FetchedDocument): Promise<ParsedLegalDocument> {
    if (fetched.accessRestricted || !fetched.text) {
      throw new Error(fetched.errorMessage || "ACCESS_RESTRICTED");
    }
    return parseLegalSourceText(fetched);
  }

  protected evaluateResponse(status: number, body: string, finalUrl?: string) {
    return detectAccessRestriction({ status, body, finalUrl });
  }
}
