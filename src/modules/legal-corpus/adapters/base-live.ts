import { getEnv } from "@/lib/env";
import { corpusFetch } from "@/modules/legal-corpus/http";
import { parseLegalSourceText } from "@/modules/legal-corpus/parse";
import type {
  DiscoveredDocument,
  FetchedDocument,
  LegalSourceAdapter,
  ParsedLegalDocument,
} from "@/modules/legal-corpus/types";

/**
 * Conservative live probe helper.
 * Never bypasses auth/CAPTCHA/paywalls. On restriction, returns ACCESS_RESTRICTED.
 */
export async function probeSourceAccess(baseUrl: string): Promise<{
  accessible: boolean;
  status?: number;
  reason?: string;
}> {
  try {
    const response = await corpusFetch(baseUrl, { method: "GET" });
    if (response.status === 401 || response.status === 403) {
      return {
        accessible: false,
        status: response.status,
        reason: "HTTP authentication/forbidden",
      };
    }
    if (response.status === 429) {
      return {
        accessible: false,
        status: response.status,
        reason: "Rate limited by source",
      };
    }
    if (!response.ok) {
      return {
        accessible: false,
        status: response.status,
        reason: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    // Heuristic: login/captcha walls are not bulk-ingestible.
    if (
      /captcha|recaptcha|cloudflare|login|تسجيل الدخول|اشتراك|subscription/i.test(
        body,
      )
    ) {
      return {
        accessible: false,
        status: response.status,
        reason: "Interactive login/CAPTCHA/subscription wall detected",
      };
    }

    // Do not treat a portal homepage as bulk-ingestible legislation archive.
    if (contentType.includes("text/html") && body.length < 200) {
      return {
        accessible: false,
        status: response.status,
        reason: "Insufficient public content for ingestion",
      };
    }

    return { accessible: true, status: response.status };
  } catch (error) {
    return {
      accessible: false,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "Request timed out"
          : "Network error while probing source",
    };
  }
}

export function createRestrictedAdapter(input: {
  key: string;
  baseUrl: string;
  documentType: DiscoveredDocument["documentType"];
}): LegalSourceAdapter {
  return {
    key: input.key,
    async discover() {
      const env = getEnv();
      if (env.LEGAL_CORPUS_MODE !== "live") {
        return [];
      }

      // Optional network probe (off by default — never required for ACCESS_RESTRICTED).
      if (process.env.LEGAL_CORPUS_ALLOW_LIVE_PROBE === "true") {
        const probe = await probeSourceAccess(input.baseUrl);
        if (!probe.accessible) {
          return [
            {
              sourceUrl: input.baseUrl,
              title: `Access probe for ${input.key}`,
              documentType: input.documentType,
              externalId: `${input.key}-access-probe`,
              metadata: {
                accessRestricted: true,
                reason: probe.reason,
                httpStatus: probe.status,
              },
            },
          ];
        }
      }

      // Live bulk discovery intentionally not implemented without legal review.
      // No CAPTCHA/paywall/auth bypass is attempted.
      return [
        {
          sourceUrl: input.baseUrl,
          title: `Live bulk discovery deferred for ${input.key}`,
          documentType: input.documentType,
          externalId: `${input.key}-bulk-deferred`,
          metadata: {
            accessRestricted: true,
            reason:
              "Automated bulk ingestion deferred pending terms-of-use/legal review; no access bypass attempted",
          },
        },
      ];
    },
    async fetch(discovered: DiscoveredDocument): Promise<FetchedDocument> {
      return {
        sourceUrl: discovered.sourceUrl,
        externalId: discovered.externalId,
        title: discovered.title || input.key,
        documentType: discovered.documentType,
        contentType: "text/plain",
        rawBytes: Buffer.from(""),
        textOrigin: "METADATA",
        accessRestricted: true,
        errorCategory: "ACCESS_RESTRICTED",
        errorMessage: String(
          discovered.metadata?.reason ??
            "Source not approved for automated bulk ingestion",
        ),
        metadata: discovered.metadata,
      };
    },
    async parse(fetched: FetchedDocument): Promise<ParsedLegalDocument> {
      if (fetched.accessRestricted || !fetched.text) {
        throw new Error(fetched.errorMessage || "ACCESS_RESTRICTED");
      }
      return parseLegalSourceText(fetched);
    },
  };
}
