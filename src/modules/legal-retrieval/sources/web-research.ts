import { canonicalizeUrl } from "@/modules/legal-corpus/checksum";
import { getWebResearchConfig, webAuthorityScore } from "@/modules/legal-retrieval/config";
import type {
  LegalEvidence,
  ResearchSourceRecord,
  RetrievalSource,
  RetrievalSourceQuery,
  WebAuthorityStatus,
} from "@/modules/legal-retrieval/types";
import { chunkWebDocument, discoveryOnlyRecord } from "@/modules/legal-retrieval/web/chunk";
import { classifyWebDomain } from "@/modules/legal-retrieval/web/classify";
import { fetchWebPage } from "@/modules/legal-retrieval/web/fetch";
import {
  createWebSearchProvider,
  isWebSearchConfigured,
} from "@/modules/legal-retrieval/web/providers";
import type { WebSearchProvider, WebSearchResult } from "@/modules/legal-retrieval/web/types";
import { assertSafeHttpUrl } from "@/modules/legal-retrieval/web/ssrf";

export type WebResearchSearchResult = {
  evidence: LegalEvidence[];
  researchSources: ResearchSourceRecord[];
  discoveryCount: number;
};

type FetchFn = typeof fetchWebPage;

let searchProviderOverride: WebSearchProvider | null = null;
let fetchOverride: FetchFn | null = null;

export function setWebResearchDependenciesForTests(input: {
  searchProvider?: WebSearchProvider | null;
  fetchPage?: FetchFn | null;
}) {
  if ("searchProvider" in input) {
    searchProviderOverride = input.searchProvider ?? null;
  }
  if ("fetchPage" in input) {
    fetchOverride = input.fetchPage ?? null;
  }
}

function dedupeSearchResults(results: WebSearchResult[]): WebSearchResult[] {
  const seenUrl = new Set<string>();
  const seenSnippet = new Set<string>();
  const unique: WebSearchResult[] = [];
  for (const result of results) {
    const urlKey = canonicalizeUrl(result.url);
    const snippetKey = result.snippet.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 240);
    if (seenUrl.has(urlKey)) {
      continue;
    }
    if (snippetKey && seenSnippet.has(snippetKey)) {
      continue;
    }
    seenUrl.add(urlKey);
    if (snippetKey) {
      seenSnippet.add(snippetKey);
    }
    unique.push(result);
  }
  return unique;
}

function rankCandidates(results: WebSearchResult[]): Array<{
  result: WebSearchResult;
  authority: WebAuthorityStatus;
  sourceName: string;
  rankScore: number;
}> {
  return results
    .map((result, index) => {
      const classified = classifyWebDomain(result.domain || new URL(result.url).hostname);
      const authorityScore = webAuthorityScore(classified.authority);
      const positionScore = 1 - index / Math.max(results.length, 1);
      return {
        result,
        authority: classified.authority,
        sourceName: classified.sourceName || result.sourceName,
        rankScore: authorityScore * 0.7 + positionScore * 0.3,
      };
    })
    .sort((left, right) => right.rankScore - left.rankScore);
}

/**
 * Internet research retrieval source.
 * Search snippets are discovery-only; fetched page passages become evidence.
 * Never writes into the permanent legal corpus.
 */
export class WebResearchRetrievalSource implements RetrievalSource {
  readonly kind = "WEB_RESEARCH" as const;

  async search(input: RetrievalSourceQuery): Promise<LegalEvidence[]> {
    const result = await this.searchDetailed(input);
    return result.evidence;
  }

  async searchDetailed(input: RetrievalSourceQuery): Promise<WebResearchSearchResult> {
    const query = input.query.trim();
    if (!query) {
      return { evidence: [], researchSources: [], discoveryCount: 0 };
    }
    if (!isWebSearchConfigured() && !searchProviderOverride) {
      return { evidence: [], researchSources: [], discoveryCount: 0 };
    }

    const config = getWebResearchConfig();
    const provider = searchProviderOverride ?? createWebSearchProvider();
    const fetchPage = fetchOverride ?? fetchWebPage;

    let rawResults: WebSearchResult[] = [];
    try {
      rawResults = await provider.search(query, {
        maxResults: input.limit ?? config.maxResults,
      });
    } catch (error) {
      console.error("[web-research] search failed", {
        message: error instanceof Error ? error.message : "unknown",
        provider: provider.name,
      });
      return { evidence: [], researchSources: [], discoveryCount: 0 };
    }

    const results = dedupeSearchResults(
      rawResults.filter((item) => assertSafeHttpUrl(item.url).ok),
    );
    const ranked = rankCandidates(results);
    const fetchLimit = Math.min(config.fetchCandidates, ranked.length);
    const toFetch = ranked.slice(0, fetchLimit);

    const researchSources: ResearchSourceRecord[] = [];
    const evidence: LegalEvidence[] = [];
    const seenContent = new Set<string>();

    for (const candidate of ranked) {
      const discovery = discoveryOnlyRecord({
        url: candidate.result.url,
        title: candidate.result.title,
        domain: candidate.result.domain,
        sourceName: candidate.sourceName,
        authority: candidate.authority,
        publishedAt: candidate.result.publishedAt,
        retrievedAt: candidate.result.retrievedAt,
        sourceStatus: "UNFETCHED",
        relevanceScore: candidate.rankScore,
        // Snippets are discovery metadata only — never final legal evidence.
        excerpt: null,
      });
      researchSources.push(discovery);
    }

    for (const candidate of toFetch) {
      const fetched = await fetchPage({
        url: candidate.result.url,
        sourceName: candidate.sourceName,
        domain: candidate.result.domain,
        authorityStatus: candidate.authority,
        publishedAt: candidate.result.publishedAt,
      });

      const sourceIndex = researchSources.findIndex(
        (item) => canonicalizeUrl(item.url) === canonicalizeUrl(candidate.result.url),
      );

      if (!fetched.ok) {
        if (sourceIndex >= 0) {
          researchSources[sourceIndex] = {
            ...researchSources[sourceIndex]!,
            sourceStatus: fetched.sourceStatus,
            url: fetched.url,
          };
        }
        continue;
      }

      if (seenContent.has(fetched.document.checksum)) {
        if (sourceIndex >= 0) {
          researchSources[sourceIndex] = {
            ...researchSources[sourceIndex]!,
            sourceStatus: "FETCHED",
            url: fetched.document.url,
            title: fetched.document.title,
            retrievedAt: fetched.document.retrievedAt,
          };
        }
        continue;
      }
      seenContent.add(fetched.document.checksum);

      if (sourceIndex >= 0) {
        researchSources[sourceIndex] = {
          ...researchSources[sourceIndex]!,
          url: fetched.document.url,
          title: fetched.document.title,
          sourceStatus: "FETCHED",
          retrievedAt: fetched.document.retrievedAt,
          publishedAt: fetched.document.publishedAt,
          excerpt: fetched.document.content.slice(0, 280),
          relevanceScore: candidate.rankScore + webAuthorityScore(candidate.authority) * 0.2,
        };
      }

      const chunks = chunkWebDocument({
        document: fetched.document,
        query,
        authority: candidate.authority,
      }).map((item) => ({
        ...item,
        score:
          item.score * 0.55 +
          webAuthorityScore(candidate.authority) * 0.35 +
          candidate.rankScore * 0.1,
      }));
      evidence.push(...chunks);
    }

    evidence.sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId));

    console.error("[web-research] search", {
      queryChars: query.length,
      discovery: researchSources.length,
      fetchedEvidence: evidence.length,
      provider: provider.name,
    });

    return {
      evidence,
      researchSources,
      discoveryCount: researchSources.length,
    };
  }
}
