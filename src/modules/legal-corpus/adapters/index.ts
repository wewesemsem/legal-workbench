import { readFileSync } from "node:fs";
import path from "node:path";

import { createRestrictedAdapter } from "@/modules/legal-corpus/adapters/base-live";
import {
  createCassationHeritageFixtureAdapter,
  createElpFixtureAdapter,
  createParliamentFixtureAdapter,
  createSccFixtureAdapter,
} from "@/modules/legal-corpus/adapters/fixture";
import { createAmiriPressPublicAdapter } from "@/modules/legal-corpus/adapters/amiri-public";
import { createParliamentConstitutionAdapter } from "@/modules/legal-corpus/adapters/parliament-constitution";
import { createParliamentPublicAdapter } from "@/modules/legal-corpus/adapters/parliament-public";
import { createSccPublicAdapter } from "@/modules/legal-corpus/adapters/scc-public";
import type { ConstitutionSnapshot } from "@/modules/legal-corpus/constitution";
import { getEnv } from "@/lib/env";
import type { LegalSourceAdapter } from "@/modules/legal-corpus/types";

/**
 * Verified official/public base URLs (do not invent undocumented deep links).
 * Reachable ≠ approved_for_automated_acquisition.
 */
export const EGYPT_SOURCE_SEEDS = [
  {
    id: "src_egypt_parliament_constitution",
    adapterKey: "egypt-parliament-constitution",
    name: "Egyptian Parliament — Constitution",
    authority: "Egyptian Parliament",
    country: "EG",
    jurisdiction: "NATIONAL",
    baseUrl: "https://parliament.gov.eg/Constitution.aspx",
    sourceType: "LEGISLATIVE" as const,
    accessStatus: "PUBLIC" as const,
    authorityStatus: "AUTHORITATIVE_SOURCE" as const,
    acquisitionMethod: "OFFICIAL_PUBLIC_WEB" as const,
    approvedForAutomatedAcquisition: true,
    notes:
      "Official Parliament Constitution page. Structured public-web acquisition of Arabic constitutional text.",
  },
  {
    id: "src_egypt_parliament",
    adapterKey: "egypt-parliament",
    name: "Egyptian House of Representatives",
    authority: "Egyptian Parliament",
    country: "EG",
    jurisdiction: "NATIONAL",
    baseUrl: "https://www.parliament.gov.eg/",
    sourceType: "LEGISLATIVE" as const,
    accessStatus: "REVIEW_REQUIRED" as const,
    authorityStatus: "AUTHORITATIVE_SOURCE" as const,
    acquisitionMethod: "OFFICIAL_PUBLIC_WEB" as const,
    approvedForAutomatedAcquisition: true,
    notes:
      "Official parliament site discovery. Bills/agendas/commentary are not classified as enacted law. Constitution structured ingest uses src_egypt_parliament_constitution.",
  },
  {
    id: "src_egypt_scc",
    adapterKey: "egypt-scc",
    name: "Supreme Constitutional Court of Egypt",
    authority: "Supreme Constitutional Court",
    country: "EG",
    jurisdiction: "NATIONAL",
    baseUrl: "https://www.sccourt.gov.eg/",
    sourceType: "JUDICIAL" as const,
    accessStatus: "REVIEW_REQUIRED" as const,
    authorityStatus: "AUTHORITATIVE_SOURCE" as const,
    acquisitionMethod: "OFFICIAL_PUBLIC_WEB" as const,
    approvedForAutomatedAcquisition: true,
    notes:
      "Official SCC site. Conservative public acquisition only; summaries classified as SUMMARY; restricted pages skipped.",
  },
  {
    id: "src_egypt_amiri",
    adapterKey: "egypt-amiri",
    name: "Egyptian Amiri Press / Official Legislation",
    authority: "Amiri Press",
    country: "EG",
    jurisdiction: "NATIONAL",
    baseUrl: "http://alamiria.com/Sec/Home",
    sourceType: "OFFICIAL_GAZETTE" as const,
    accessStatus: "REVIEW_REQUIRED" as const,
    authorityStatus: "AUTHORITATIVE_SOURCE" as const,
    acquisitionMethod: "OFFICIAL_PUBLIC_WEB" as const,
    approvedForAutomatedAcquisition: true,
    notes:
      "Amiri Press portal. Discover publicly reachable material; record ACCESS_RESTRICTED when authentication is required. No bypass.",
  },
  {
    id: "src_egypt_elp",
    adapterKey: "egypt-elp",
    name: "Egyptian Legal Legislation Portal (ELP / IDSC)",
    authority: "Cabinet Information and Decision Support Center (IDSC)",
    country: "EG",
    jurisdiction: "Egypt",
    baseUrl: "https://elpai.idsc.gov.eg/",
    sourceType: "LEGISLATION" as const,
    accessStatus: "REVIEW_REQUIRED" as const,
    authorityStatus: "AUTHORITATIVE_SOURCE" as const,
    acquisitionMethod: "FUTURE_CONNECTOR" as const,
    approvedForAutomatedAcquisition: false,
    notes:
      "Official Egyptian legislation portal. Automated bulk acquisition deferred. Use approved manifest import for legitimately obtained documents.",
  },
  {
    id: "src_egypt_cassation_heritage",
    adapterKey: "egypt-cassation-heritage",
    name: "Court of Cassation Heritage / Electronic Library",
    authority: "Court of Cassation of Egypt",
    country: "EG",
    jurisdiction: "Egypt",
    baseUrl: "https://www.cc.gov.eg/",
    sourceType: "JUDICIAL" as const,
    accessStatus: "REVIEW_REQUIRED" as const,
    authorityStatus: "AUTHORITATIVE_SOURCE" as const,
    acquisitionMethod: "FUTURE_CONNECTOR" as const,
    approvedForAutomatedAcquisition: false,
    notes:
      "Official Court of Cassation portal. Heritage bulk endpoints not confidently verified; no invented deep URLs. Approved OCR imports allowed with content_type=OCR.",
  },
] as const;

export const OFFICIAL_INGEST_ALIASES: Record<string, string> = {
  "parliament-constitution": "src_egypt_parliament_constitution",
  "scc-public": "src_egypt_scc",
  "amiri-public": "src_egypt_amiri",
  "parliament-public": "src_egypt_parliament",
};

function loadConstitutionSnapshotFromFile(
  snapshotPath: string,
  robotsNote: string,
): ConstitutionSnapshot {
  const sample = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
    sourceUrl?: string;
    source_url?: string;
    retrievedAt?: string;
    retrieved_at?: string;
    hostname?: string;
    title: string;
    preamble?: string;
    articles: Array<{
      bab?: string;
      chapter?: string;
      section?: string;
      number: string;
      label?: string;
      text: string;
    }>;
    rawHtmlHash?: string;
    robotsNote?: string;
  };
  return {
    sourceUrl:
      sample.sourceUrl ??
      sample.source_url ??
      "https://parliament.gov.eg/Constitution.aspx",
    retrievedAt:
      sample.retrievedAt ??
      sample.retrieved_at ??
      "2026-10-03T00:00:00.000Z",
    hostname: sample.hostname ?? "parliament.gov.eg",
    title: sample.title,
    preamble: sample.preamble,
    articles: sample.articles.map((article) => ({
      number: article.number,
      text: article.text,
      bab: article.bab,
      chapter: article.chapter,
      section: article.section,
      label: article.label,
    })),
    rawHtmlHash: sample.rawHtmlHash,
    robotsNote: sample.robotsNote ?? robotsNote,
  };
}

function loadConstitutionFixtureSnapshot(): ConstitutionSnapshot {
  const overridePath = process.env.LEGAL_CORPUS_CONSTITUTION_SNAPSHOT_PATH?.trim();
  if (overridePath) {
    const resolved = path.isAbsolute(overridePath)
      ? overridePath
      : path.join(process.cwd(), overridePath);
    return loadConstitutionSnapshotFromFile(
      resolved,
      "restored offline constitution snapshot",
    );
  }
  const fixturePath = path.join(
    process.cwd(),
    "fixtures/legal-corpus/official-web/constitution-sample.json",
  );
  return loadConstitutionSnapshotFromFile(
    fixturePath,
    "fixture snapshot for offline tests",
  );
}

export function getAdapter(adapterKey: string): LegalSourceAdapter {
  const env = getEnv();
  const snapshotOverride = process.env.LEGAL_CORPUS_CONSTITUTION_SNAPSHOT_PATH?.trim();
  const useFixtures = env.LEGAL_CORPUS_MODE !== "live" || Boolean(snapshotOverride);

  if (adapterKey === "egypt-parliament-constitution") {
    // Fixture mode / explicit snapshot path uses an offline Constitution snapshot
    // (authoritative SOURCE_TEXT provenance is still set by the adapter).
    return createParliamentConstitutionAdapter(
      useFixtures
        ? { offlineSnapshot: loadConstitutionFixtureSnapshot() }
        : undefined,
    );
  }

  if (useFixtures) {
    switch (adapterKey) {
      case "egypt-elp":
        return createElpFixtureAdapter();
      case "egypt-scc":
        return createSccFixtureAdapter();
      case "egypt-cassation-heritage":
        return createCassationHeritageFixtureAdapter();
      case "egypt-parliament":
        return createParliamentFixtureAdapter();
      case "egypt-amiri":
        return createRestrictedAdapter({
          key: adapterKey,
          baseUrl: "http://alamiria.com/Sec/Home",
          documentType: "LEGISLATION",
        });
      default:
        throw new Error(`Unknown legal corpus adapter: ${adapterKey}`);
    }
  }

  switch (adapterKey) {
    case "egypt-scc":
      return createSccPublicAdapter();
    case "egypt-amiri":
      return createAmiriPressPublicAdapter();
    case "egypt-parliament":
      return createParliamentPublicAdapter();
    case "egypt-elp":
    case "egypt-cassation-heritage": {
      const seed = EGYPT_SOURCE_SEEDS.find(
        (item) => item.adapterKey === adapterKey,
      );
      if (!seed) {
        throw new Error(`Unknown legal corpus adapter: ${adapterKey}`);
      }
      return createRestrictedAdapter({
        key: adapterKey,
        baseUrl: seed.baseUrl,
        documentType:
          seed.sourceType === "LEGISLATION"
            ? "LEGISLATION"
            : "HISTORICAL_LEGAL_MATERIAL",
      });
    }
    default:
      throw new Error(`Unknown legal corpus adapter: ${adapterKey}`);
  }
}

export function resolveSourceIdAlias(aliasOrId: string) {
  return OFFICIAL_INGEST_ALIASES[aliasOrId] ?? aliasOrId;
}
