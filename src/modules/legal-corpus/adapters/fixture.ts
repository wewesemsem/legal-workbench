import {
  SAMPLE_EMPLOYMENT_LAW_FIXTURE,
  SAMPLE_HERITAGE_PAGE_FIXTURE,
  SAMPLE_PARLIAMENT_BILL_FIXTURE,
  SAMPLE_SCC_SUMMARY_FIXTURE,
} from "@/modules/legal-corpus/fixtures/sample-legislation-ar";
import { parseLegalSourceText } from "@/modules/legal-corpus/parse";
import type {
  DiscoveredDocument,
  FetchedDocument,
  LegalSourceAdapter,
} from "@/modules/legal-corpus/types";

function fixtureToDiscovered(
  fixture: {
    externalId: string;
    sourceUrl: string;
    title: string;
    documentType: DiscoveredDocument["documentType"];
  },
  metadata?: Record<string, unknown>,
): DiscoveredDocument {
  return {
    sourceUrl: fixture.sourceUrl,
    title: fixture.title,
    documentType: fixture.documentType,
    externalId: fixture.externalId,
    metadata: {
      fixture: true,
      authoritative: false,
      ...metadata,
    },
  };
}

function fixtureFetch(
  fixture: {
    externalId: string;
    sourceUrl: string;
    title: string;
    documentType: FetchedDocument["documentType"];
    textOrigin: FetchedDocument["textOrigin"];
    issuingAuthority: string;
    text: string;
    year?: number;
    documentNumber?: string;
    pageNumber?: number;
  },
): FetchedDocument {
  return {
    sourceUrl: fixture.sourceUrl,
    externalId: fixture.externalId,
    title: fixture.title,
    documentType: fixture.documentType,
    contentType: "text/plain; charset=utf-8",
    rawBytes: Buffer.from(fixture.text, "utf8"),
    text: fixture.text,
    textOrigin: fixture.textOrigin,
    metadata: {
      issuingAuthority: fixture.issuingAuthority,
      year: fixture.year,
      documentNumber: fixture.documentNumber,
      pageNumber: fixture.pageNumber,
      fixture: true,
      authoritative: false,
    },
  };
}

export function createElpFixtureAdapter(): LegalSourceAdapter {
  return {
    key: "egypt-elp",
    async discover() {
      return [fixtureToDiscovered(SAMPLE_EMPLOYMENT_LAW_FIXTURE)];
    },
    async fetch() {
      return fixtureFetch(SAMPLE_EMPLOYMENT_LAW_FIXTURE);
    },
    async parse(fetched) {
      return parseLegalSourceText(fetched);
    },
  };
}

export function createSccFixtureAdapter(): LegalSourceAdapter {
  return {
    key: "egypt-scc",
    async discover() {
      return [fixtureToDiscovered(SAMPLE_SCC_SUMMARY_FIXTURE)];
    },
    async fetch() {
      return fixtureFetch(SAMPLE_SCC_SUMMARY_FIXTURE);
    },
    async parse(fetched) {
      return parseLegalSourceText(fetched);
    },
  };
}

export function createCassationHeritageFixtureAdapter(): LegalSourceAdapter {
  return {
    key: "egypt-cassation-heritage",
    async discover() {
      return [
        fixtureToDiscovered(SAMPLE_HERITAGE_PAGE_FIXTURE, {
          collectionTitle: "مكتبة تراث محكمة النقض (عينة)",
          pageNumber: 7,
          year: 1920,
        }),
      ];
    },
    async fetch() {
      return fixtureFetch(SAMPLE_HERITAGE_PAGE_FIXTURE);
    },
    async parse(fetched) {
      const parsed = parseLegalSourceText(fetched);
      // Preserve page reference for OCR heritage material.
      for (const provision of parsed.provisions) {
        provision.pageNumber = SAMPLE_HERITAGE_PAGE_FIXTURE.pageNumber;
        for (const child of provision.children ?? []) {
          child.pageNumber = SAMPLE_HERITAGE_PAGE_FIXTURE.pageNumber;
        }
      }
      return parsed;
    },
  };
}

export function createParliamentFixtureAdapter(): LegalSourceAdapter {
  return {
    key: "egypt-parliament",
    async discover() {
      return [fixtureToDiscovered(SAMPLE_PARLIAMENT_BILL_FIXTURE)];
    },
    async fetch() {
      return fixtureFetch(SAMPLE_PARLIAMENT_BILL_FIXTURE);
    },
    async parse(fetched) {
      return parseLegalSourceText(fetched);
    },
  };
}
