import { getWebResearchConfig } from "@/modules/legal-retrieval/config";
import type {
  WebSearchOptions,
  WebSearchProvider,
  WebSearchResult,
} from "@/modules/legal-retrieval/web/types";

const BRAVE_SEARCH_BASE_URL = "https://api.search.brave.com/res/v1/web/search";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function mapBraveResult(raw: {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  snippet?: unknown;
  age?: unknown;
  meta_url?: { hostname?: unknown };
}): WebSearchResult | null {
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!url || !title) {
    return null;
  }
  const snippet =
    (typeof raw.description === "string" && raw.description.trim()) ||
    (typeof raw.snippet === "string" && raw.snippet.trim()) ||
    "";
  const domain =
    (typeof raw.meta_url?.hostname === "string" &&
      raw.meta_url.hostname.replace(/^www\./i, "").toLowerCase()) ||
    domainFromUrl(url);
  const publishedAt = typeof raw.age === "string" && raw.age.trim() ? raw.age.trim() : null;

  return {
    url,
    title,
    snippet,
    sourceName: domain || "Web",
    domain,
    publishedAt,
    retrievedAt: new Date().toISOString(),
    metadata: { provider: "brave" },
  };
}

export class BraveWebSearchProvider implements WebSearchProvider {
  readonly name = "brave";

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const config = getWebResearchConfig();
    const apiKey = config.braveApiKey;
    if (!apiKey) {
      throw new Error("Internet search is not configured (BRAVE_SEARCH_API_KEY missing)");
    }

    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    const count = Math.min(
      Math.max(options.maxResults ?? config.maxResults, 1),
      config.maxResults,
    );
    const params = new URLSearchParams({
      q: normalized.slice(0, 400),
      count: String(count),
    });
    if (options.locale) {
      params.set("search_lang", options.locale.slice(0, 2));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
    try {
      const response = await fetch(`${BRAVE_SEARCH_BASE_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
          "User-Agent": config.userAgent,
        },
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok) {
        throw new Error(`Web search provider returned HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        web?: { results?: Array<Record<string, unknown>> };
      };
      const raw = body.web?.results ?? [];
      return raw
        .map((item) => mapBraveResult(item as Parameters<typeof mapBraveResult>[0]))
        .filter((item): item is WebSearchResult => item !== null);
    } finally {
      clearTimeout(timeout);
    }
  }
}
