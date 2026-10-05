import type {
  WebSearchOptions,
  WebSearchProvider,
  WebSearchResult,
} from "@/modules/legal-retrieval/web/types";

export type MockWebSearchFixture = {
  queryIncludes?: string[];
  results: Array<Omit<WebSearchResult, "retrievedAt"> & { retrievedAt?: string }>;
};

let fixtures: MockWebSearchFixture[] = defaultFixtures();

function defaultFixtures(): MockWebSearchFixture[] {
  return [
    {
      queryIncludes: ["law 12", "law no. 12", "قانون رقم 12", "12 of 2003", "12 لسنة 2003"],
      results: [
        {
          url: "https://www.egypt.gov.eg/english/laws/labour-12-2003",
          title: "Labour Law No. 12 of 2003 — Official Government Portal",
          snippet:
            "Discovery snippet only. Official overview of Egyptian Labour Law No. 12 of 2003.",
          sourceName: "egypt.gov.eg",
          domain: "egypt.gov.eg",
          publishedAt: "2003-04-07",
          metadata: { fixture: true },
        },
        {
          url: "https://legalcommentary.example/egypt-labour-law-12-2003",
          title: "Commentary on Egyptian Labour Law 12/2003",
          snippet: "Secondary legal commentary discussing Law No. 12 of 2003.",
          sourceName: "legalcommentary.example",
          domain: "legalcommentary.example",
          publishedAt: "2020-01-15",
          metadata: { fixture: true },
        },
      ],
    },
    {
      queryIncludes: ["equality", "مساواة", "متساو"],
      results: [
        {
          url: "https://www.parliament.gov.eg/Constitution.aspx",
          title: "Constitution of the Arab Republic of Egypt — Parliament",
          snippet: "Parliamentary publication of the Constitution including equality principles.",
          sourceName: "parliament.gov.eg",
          domain: "parliament.gov.eg",
          publishedAt: "2014-01-18",
          metadata: { fixture: true },
        },
      ],
    },
    {
      queryIncludes: ["education", "تعليم", "تعليم"],
      results: [
        {
          url: "https://moe.gov.eg/en/education-rights",
          title: "Ministry of Education — Education Rights",
          snippet: "Ministry page describing education rights under Egyptian law.",
          sourceName: "moe.gov.eg",
          domain: "moe.gov.eg",
          publishedAt: null,
          metadata: { fixture: true },
        },
      ],
    },
  ];
}

export function setMockWebSearchFixtures(next: MockWebSearchFixture[]) {
  fixtures = next;
}

export function resetMockWebSearchFixtures() {
  fixtures = defaultFixtures();
}

export class MockWebSearchProvider implements WebSearchProvider {
  readonly name = "mock";

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }
    const retrievedAt = new Date().toISOString();
    const matched = fixtures.find((fixture) => {
      const tokens = fixture.queryIncludes ?? [];
      if (!tokens.length) {
        return false;
      }
      return tokens.some((token) => normalized.includes(token.toLowerCase()));
    });
    const results = (matched?.results ?? []).map((result) => ({
      ...result,
      retrievedAt: result.retrievedAt ?? retrievedAt,
    }));
    const limit = options.maxResults ?? results.length;
    return results.slice(0, limit);
  }
}
