import { getWebResearchConfig } from "@/modules/legal-retrieval/config";
import { BraveWebSearchProvider } from "@/modules/legal-retrieval/web/providers/brave";
import { MockWebSearchProvider } from "@/modules/legal-retrieval/web/providers/mock";
import type { WebSearchProvider } from "@/modules/legal-retrieval/web/types";

let override: WebSearchProvider | null = null;

export function createWebSearchProvider(): WebSearchProvider {
  if (override) {
    return override;
  }
  const config = getWebResearchConfig();
  if (config.provider === "mock") {
    if (process.env.NODE_ENV !== "test") {
      throw new Error(
        "WEB_SEARCH_PROVIDER=mock is only allowed in tests. Set WEB_SEARCH_PROVIDER=brave and BRAVE_SEARCH_API_KEY.",
      );
    }
    return new MockWebSearchProvider();
  }
  return new BraveWebSearchProvider();
}

export function setWebSearchProviderForTests(provider: WebSearchProvider | null) {
  override = provider;
}

export function isWebSearchConfigured(): boolean {
  const config = getWebResearchConfig();
  if (config.provider === "mock") {
    return process.env.NODE_ENV === "test";
  }
  return Boolean(config.braveApiKey);
}
