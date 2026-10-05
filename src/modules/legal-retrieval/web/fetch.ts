import { detectAccessRestriction } from "@/modules/legal-corpus/http";
import { canonicalizeUrl } from "@/modules/legal-corpus/checksum";
import { getWebResearchConfig } from "@/modules/legal-retrieval/config";
import { extractWebPageContent } from "@/modules/legal-retrieval/web/extract";
import { assertSafeFetchTarget, assertSafeHttpUrl } from "@/modules/legal-retrieval/web/ssrf";
import type { WebDocument } from "@/modules/legal-retrieval/web/types";

export type FetchWebPageResult =
  | { ok: true; document: WebDocument }
  | {
      ok: false;
      url: string;
      sourceStatus: "UNFETCHED" | "ACCESS_RESTRICTED" | "ERROR";
      reason: string;
    };

async function readBodyLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      return { text: "", truncated: true };
    }
    return { text, truncated: false };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      return { text: "", truncated: true };
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return { text: buffer.toString("utf8"), truncated: false };
}

export async function fetchWebPage(input: {
  url: string;
  sourceName: string;
  domain: string;
  authorityStatus: string;
  publishedAt?: string | null;
}): Promise<FetchWebPageResult> {
  const config = getWebResearchConfig();
  const initial = await assertSafeFetchTarget(input.url);
  if (!initial.ok) {
    return {
      ok: false,
      url: input.url,
      sourceStatus: "ERROR",
      reason: "blocked_target",
    };
  }

  let currentUrl = initial.url.toString();
  let redirects = 0;

  while (redirects <= config.fetchMaxRedirects) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent": config.userAgent,
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return {
            ok: false,
            url: currentUrl,
            sourceStatus: "ERROR",
            reason: "redirect_missing",
          };
        }
        const next = new URL(location, currentUrl).toString();
        const safe = await assertSafeFetchTarget(next);
        if (!safe.ok) {
          return {
            ok: false,
            url: currentUrl,
            sourceStatus: "ERROR",
            reason: "redirect_blocked",
          };
        }
        currentUrl = safe.url.toString();
        redirects += 1;
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType &&
        !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)
      ) {
        return {
          ok: false,
          url: currentUrl,
          sourceStatus: "ACCESS_RESTRICTED",
          reason: "unsupported_content_type",
        };
      }

      const body = await readBodyLimited(response, config.fetchMaxBytes);
      if (body.truncated) {
        return {
          ok: false,
          url: currentUrl,
          sourceStatus: "ERROR",
          reason: "response_too_large",
        };
      }

      const restriction = detectAccessRestriction({
        status: response.status,
        body: body.text,
        finalUrl: currentUrl,
      });
      if (restriction.restricted) {
        return {
          ok: false,
          url: currentUrl,
          sourceStatus: "ACCESS_RESTRICTED",
          reason: "access_restricted",
        };
      }

      const extracted = extractWebPageContent({ html: body.text, url: currentUrl });
      if (extracted.content.length < 40) {
        return {
          ok: false,
          url: currentUrl,
          sourceStatus: "UNFETCHED",
          reason: "empty_content",
        };
      }

      const retrievedAt = new Date().toISOString();
      return {
        ok: true,
        document: {
          url: currentUrl,
          canonicalUrl: canonicalizeUrl(currentUrl),
          title: extracted.title || input.sourceName,
          sourceName: input.sourceName,
          domain: input.domain,
          publishedAt: input.publishedAt ?? null,
          retrievedAt,
          content: extracted.content,
          language: extracted.language,
          contentType: contentType.split(";")[0]?.trim() || "text/html",
          authorityStatus: input.authorityStatus,
          sourceType: "WEB",
          checksum: extracted.checksum,
          sourceStatus: "FETCHED",
        },
      };
    } catch {
      return {
        ok: false,
        url: currentUrl,
        sourceStatus: "UNFETCHED",
        reason: "fetch_failed",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    url: currentUrl,
    sourceStatus: "ERROR",
    reason: "too_many_redirects",
  };
}

export function validatePublicHttpUrl(url: string): boolean {
  return assertSafeHttpUrl(url).ok;
}
