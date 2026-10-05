export type WebSearchOptions = {
  maxResults?: number;
  locale?: string;
};

export type WebSearchResult = {
  url: string;
  title: string;
  snippet: string;
  sourceName: string;
  domain: string;
  publishedAt: string | null;
  retrievedAt: string;
  metadata: Record<string, unknown>;
};

export interface WebSearchProvider {
  readonly name: string;
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
}

export type WebDocument = {
  url: string;
  canonicalUrl: string;
  title: string;
  sourceName: string;
  domain: string;
  publishedAt: string | null;
  retrievedAt: string;
  content: string;
  language: string;
  contentType: string;
  authorityStatus: string;
  sourceType: "WEB";
  checksum: string;
  sourceStatus: "FETCHED" | "UNFETCHED" | "ACCESS_RESTRICTED" | "ERROR";
};
