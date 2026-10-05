import type { WebAuthorityStatus } from "@/modules/legal-retrieval/types";

export type DomainAuthorityRule = {
  suffixes: string[];
  authority: WebAuthorityStatus;
  sourceName: string;
};

/** Configurable Egyptian official / legal domain priority (not an exhaustive crawl list). */
export const DEFAULT_DOMAIN_AUTHORITY_RULES: DomainAuthorityRule[] = [
  {
    suffixes: ["parliament.gov.eg", "house.gov.eg", "senate.gov.eg"],
    authority: "OFFICIAL_PARLIAMENT",
    sourceName: "Egyptian Parliament",
  },
  {
    suffixes: ["sccourt.gov.eg", "cc.gov.eg", "egypt.gov.eg/courts"],
    authority: "OFFICIAL_COURT",
    sourceName: "Egyptian Courts",
  },
  {
    suffixes: [
      "egypt.gov.eg",
      "gov.eg",
      "cabinet.gov.eg",
      "presidency.eg",
      "sis.gov.eg",
      "moe.gov.eg",
      "mohp.gov.eg",
      "mof.gov.eg",
      "manpower.gov.eg",
    ],
    authority: "OFFICIAL_GOVERNMENT",
    sourceName: "Egyptian Government",
  },
  {
    suffixes: ["alamiria.gov.eg", "officialgazette.gov.eg"],
    authority: "PRIMARY_OFFICIAL",
    sourceName: "Official Legislative Publication",
  },
  {
    suffixes: [".edu.eg", ".edu", "scholar.google.", "ssrn.com", "jstor.org"],
    authority: "ACADEMIC",
    sourceName: "Academic Source",
  },
  {
    suffixes: [
      "law.",
      "legal.",
      "lexology.com",
      "iclg.com",
      "mondaq.com",
      "ilo.org",
    ],
    authority: "SECONDARY_LEGAL",
    sourceName: "Secondary Legal Source",
  },
];

let rules = DEFAULT_DOMAIN_AUTHORITY_RULES;

export function setDomainAuthorityRulesForTests(next: DomainAuthorityRule[]) {
  rules = next;
}

export function resetDomainAuthorityRules() {
  rules = DEFAULT_DOMAIN_AUTHORITY_RULES;
}

export function classifyWebDomain(domain: string): {
  authority: WebAuthorityStatus;
  sourceName: string;
} {
  const host = domain.replace(/^www\./i, "").toLowerCase();
  for (const rule of rules) {
    for (const suffix of rule.suffixes) {
      if (suffix.startsWith(".") || suffix.includes("/")) {
        if (host.includes(suffix.replace(/^\./, "")) || host.endsWith(suffix.replace(/^\./, ""))) {
          return { authority: rule.authority, sourceName: rule.sourceName };
        }
        continue;
      }
      if (host === suffix || host.endsWith(`.${suffix}`)) {
        return { authority: rule.authority, sourceName: rule.sourceName };
      }
      if (suffix.endsWith(".") && host.startsWith(suffix.slice(0, -1))) {
        return { authority: rule.authority, sourceName: rule.sourceName };
      }
    }
  }
  return { authority: "GENERAL_WEB", sourceName: host || "Web" };
}

export function authorityBadgeLabel(authority: WebAuthorityStatus): string {
  if (
    authority === "PRIMARY_OFFICIAL" ||
    authority === "OFFICIAL_GOVERNMENT" ||
    authority === "OFFICIAL_COURT" ||
    authority === "OFFICIAL_PARLIAMENT"
  ) {
    return "OFFICIAL";
  }
  if (authority === "SECONDARY_LEGAL" || authority === "ACADEMIC") {
    return "SECONDARY";
  }
  return "GENERAL WEB";
}
