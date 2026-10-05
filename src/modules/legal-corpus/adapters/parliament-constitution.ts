import { createHash } from "node:crypto";

import { OfficialPublicWebAdapter } from "@/modules/legal-corpus/adapters/official-web";
import {
  parseConstitutionSnapshot,
  type ConstitutionArticle,
  type ConstitutionSnapshot,
} from "@/modules/legal-corpus/constitution";
import { sha256Hex } from "@/modules/legal-corpus/checksum";
import type {
  DiscoveredDocument,
  FetchedDocument,
  ParsedLegalDocument,
} from "@/modules/legal-corpus/types";

export const PARLIAMENT_CONSTITUTION_URL =
  "https://parliament.gov.eg/Constitution.aspx";
export const PARLIAMENT_ALLOWED_HOSTS = ["parliament.gov.eg"];

const BAB = "ctl00$ContentPlaceHolder1$DropDownList1";
const CHAP = "ctl00$ContentPlaceHolder1$DropDownList2";
const SEC = "ctl00$ContentPlaceHolder1$DropDownList3";
const ART = "ctl00$ContentPlaceHolder1$DropDownList4";

type SelectOption = { value: string; text: string };

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractInputs(html: string) {
  const fields: Record<string, string> = {};
  for (const tag of html.match(/<input[^>]*>/gi) ?? []) {
    const name = tag.match(/name="([^"]+)"/i)?.[1];
    if (!name) continue;
    const type = (tag.match(/type="([^"]*)"/i)?.[1] || "text").toLowerCase();
    if (type === "submit" || type === "button" || type === "image") continue;
    const value = tag.match(/value="([^"]*)"/i)?.[1] ?? "";
    fields[name] = decodeEntities(value);
  }
  return fields;
}

function extractSelects(html: string) {
  const selects: Record<string, SelectOption[]> = {};
  const selected: Record<string, string> = {};
  const re =
    /<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const name = match[1]!;
    const block = match[2]!;
    const opts: SelectOption[] = [];
    const ore = /<option([^>]*)>([\s\S]*?)<\/option>/gi;
    let om: RegExpExecArray | null;
    while ((om = ore.exec(block))) {
      const attrs = om[1]!;
      const text = stripTags(om[2]!);
      const value = attrs.match(/value="([^"]*)"/i)?.[1] ?? text;
      opts.push({ value, text });
      if (/selected/i.test(attrs)) {
        selected[name] = value;
      }
    }
    selects[name] = opts;
    if (!(name in selected) && opts[0]) {
      selected[name] = opts[0].value;
    }
  }
  return { selects, selected };
}

function articleText(html: string) {
  const table = html.match(
    /id="ContentPlaceHolder1_GridView1"[\s\S]*?<\/table>/i,
  )?.[0];
  if (!table) return "";
  const cells = [...table.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((item) =>
    stripTags(item[1] || ""),
  );
  return cells.filter(Boolean).join("\n").trim();
}

function extractPreamble(html: string) {
  const idx = html.indexOf("ContentPlaceHolder1_LinkButton5");
  const chunk = idx >= 0 ? html.slice(0, idx) : html;
  const paragraphs = [...chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(
    (item) => stripTags(item[1] || ""),
  );
  const arabic = paragraphs
    .filter((text) => /[\u0600-\u06FF]/.test(text) && text.length > 80)
    .sort((a, b) => b.length - a.length);
  return arabic[0] ?? "";
}

function articleNumber(label: string, fallback: string) {
  const match = label.match(/(\d+)/);
  return match?.[1] ?? fallback;
}

export type ParliamentConstitutionFetchDeps = {
  /** Optional offline snapshot for tests (skips network). */
  offlineSnapshot?: ConstitutionSnapshot;
};

export class ParliamentConstitutionAdapter extends OfficialPublicWebAdapter {
  private readonly offlineSnapshot?: ConstitutionSnapshot;

  constructor(deps: ParliamentConstitutionFetchDeps = {}) {
    super({
      key: "egypt-parliament-constitution",
      allowedHosts: PARLIAMENT_ALLOWED_HOSTS,
      relaxTlsForHosts: PARLIAMENT_ALLOWED_HOSTS,
      origin: "https://parliament.gov.eg",
      defaultDocumentType: "CONSTITUTION",
    });
    this.offlineSnapshot = deps.offlineSnapshot;
  }

  async discover(): Promise<DiscoveredDocument[]> {
    if (this.offlineSnapshot) {
      return [
        {
          sourceUrl: this.offlineSnapshot.sourceUrl,
          title: this.offlineSnapshot.title,
          documentType: "CONSTITUTION",
          externalId: "egypt-constitution-2014",
          metadata: {
            hostname: this.offlineSnapshot.hostname,
            acquisition_method: "OFFICIAL_PUBLIC_WEB",
            authority_status: "AUTHORITATIVE_SOURCE",
          },
        },
      ];
    }

    this.assertUrl(PARLIAMENT_CONSTITUTION_URL);
    const robots = await this.robots();
    if (robots.disallowsAll) {
      return [
        {
          sourceUrl: PARLIAMENT_CONSTITUTION_URL,
          title: "Egyptian Constitution",
          documentType: "CONSTITUTION",
          externalId: "egypt-constitution-2014",
          metadata: {
            accessRestricted: true,
            reason: robots.note,
            accessStatus: "ACCESS_RESTRICTED",
          },
        },
      ];
    }

    const response = await this.get(PARLIAMENT_CONSTITUTION_URL);
    const body = await response.text();
    const restriction = this.evaluateResponse(
      response.status,
      body,
      response.url,
    );
    if (restriction.restricted) {
      return [
        {
          sourceUrl: PARLIAMENT_CONSTITUTION_URL,
          title: "Egyptian Constitution",
          documentType: "CONSTITUTION",
          externalId: "egypt-constitution-2014",
          metadata: {
            accessRestricted: true,
            reason: restriction.reason,
            accessStatus: restriction.accessStatus,
          },
        },
      ];
    }

    const hostname = this.assertUrl(response.url || PARLIAMENT_CONSTITUTION_URL);
    if (hostname !== "parliament.gov.eg") {
      throw new Error(`Unexpected Constitution host: ${hostname}`);
    }

    return [
      {
        sourceUrl: PARLIAMENT_CONSTITUTION_URL,
        title: "دستور جمهورية مصر العربية",
        documentType: "CONSTITUTION",
        externalId: "egypt-constitution-2014",
        metadata: {
          hostname,
          robots_note: robots.note,
          acquisition_method: "OFFICIAL_PUBLIC_WEB",
          authority_status: "AUTHORITATIVE_SOURCE",
          country: "EG",
          jurisdiction: "NATIONAL",
        },
      },
    ];
  }

  async fetch(discovered: DiscoveredDocument): Promise<FetchedDocument> {
    this.assertUrl(discovered.sourceUrl);

    if (discovered.metadata?.accessRestricted) {
      return this.restrictedFetch(
        discovered,
        String(discovered.metadata.reason ?? "ACCESS_RESTRICTED"),
      );
    }

    if (this.offlineSnapshot) {
      return this.toFetched(this.offlineSnapshot);
    }

    try {
      this.assertUrl(discovered.sourceUrl);
      const snapshot = await this.crawlConstitution();
      if (snapshot.articles.length < 2) {
        return this.restrictedFetch(
          discovered,
          "INVALID_CONTENT: fewer than 2 articles extracted from Constitution page",
        );
      }
      return this.toFetched(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (/outside adapter crawl boundary/i.test(message)) {
        throw error;
      }
      return this.restrictedFetch(discovered, message);
    }
  }

  async parse(fetched: FetchedDocument): Promise<ParsedLegalDocument> {
    if (fetched.accessRestricted) {
      throw new Error(fetched.errorMessage || "ACCESS_RESTRICTED");
    }
    const snapshot = JSON.parse(
      fetched.rawBytes.toString("utf8"),
    ) as ConstitutionSnapshot;
    return parseConstitutionSnapshot(snapshot);
  }

  private toFetched(snapshot: ConstitutionSnapshot): FetchedDocument {
    const raw = Buffer.from(JSON.stringify(snapshot), "utf8");
    return {
      sourceUrl: snapshot.sourceUrl,
      externalId: "egypt-constitution-2014",
      title: snapshot.title,
      documentType: "CONSTITUTION",
      contentType: "application/json",
      rawBytes: raw,
      text: snapshot.articles.map((article) => article.text).join("\n\n"),
      textOrigin: "SOURCE_TEXT",
      authorityStatus: "AUTHORITATIVE_SOURCE",
      acquisitionMethod: "OFFICIAL_PUBLIC_WEB",
      acquisitionNote:
        "Official public web acquisition from parliament.gov.eg/Constitution.aspx",
      reviewStatus: "PENDING_REVIEW",
      metadata: {
        hostname: snapshot.hostname,
        retrieved_at: snapshot.retrievedAt,
        article_count: snapshot.articles.length,
        content_hash: sha256Hex(raw),
        country: "EG",
        jurisdiction: "NATIONAL",
      },
    };
  }

  private async crawlConstitution(): Promise<ConstitutionSnapshot> {
    const robots = await this.robots();
    if (robots.disallowsAll) {
      throw new Error(`ACCESS_RESTRICTED: ${robots.note}`);
    }

    let html = await this.read(
      await this.get(PARLIAMENT_CONSTITUTION_URL),
      "initial GET",
    );
    const hostname = this.assertUrl(PARLIAMENT_CONSTITUTION_URL);
    const preamble = extractPreamble(html);
    const initialHtmlHash = createHash("sha256").update(html).digest("hex");
    const { selects } = extractSelects(html);
    const babs = selects[BAB] ?? [];
    if (babs.length === 0) {
      throw new Error("INVALID_CONTENT: Constitution باب dropdown missing");
    }

    const articles: ConstitutionArticle[] = [];
    const seen = new Set<string>();

    for (const bab of babs) {
      html = await this.postback(html, BAB, { [BAB]: bab.value }, `bab=${bab.value}`);
      const { selects: afterBab } = extractSelects(html);
      const chapters = afterBab[CHAP] ?? [];
      const paths =
        chapters.length > 0
          ? chapters.map((chapter) => ({ bab, chapter, section: null as SelectOption | null }))
          : [{ bab, chapter: null as SelectOption | null, section: null as SelectOption | null }];

      // Expand sections under each chapter when present.
      const expanded: Array<{
        bab: SelectOption;
        chapter: SelectOption | null;
        section: SelectOption | null;
        arts: SelectOption[];
      }> = [];

      for (const path of paths) {
        if (path.chapter) {
          html = await this.postback(
            html,
            CHAP,
            {
              [BAB]: path.bab.value,
              [CHAP]: path.chapter.value,
            },
            `chapter=${path.chapter.value}`,
          );
        }
        const parsed = extractSelects(html);
        const sections = (parsed.selects[SEC] ?? []).filter(
          (item) => item.text && item.text !== "لا يوجد",
        );
        if (sections.length > 0) {
          for (const section of sections) {
            html = await this.postback(
              html,
              SEC,
              {
                [BAB]: path.bab.value,
                ...(path.chapter ? { [CHAP]: path.chapter.value } : {}),
                [SEC]: section.value,
              },
              `section=${section.value}`,
            );
            const secParsed = extractSelects(html);
            expanded.push({
              bab: path.bab,
              chapter: path.chapter,
              section,
              arts: secParsed.selects[ART] ?? [],
            });
          }
        } else {
          expanded.push({
            bab: path.bab,
            chapter: path.chapter,
            section: null,
            arts: parsed.selects[ART] ?? [],
          });
        }
      }

      for (const path of expanded) {
        // Reselect chapter path before walking articles when we branched on sections.
        if (path.chapter) {
          html = await this.postback(
            html,
            CHAP,
            {
              [BAB]: path.bab.value,
              [CHAP]: path.chapter.value,
            },
            `reselect-chapter=${path.chapter.value}`,
          );
        }
        if (path.section) {
          html = await this.postback(
            html,
            SEC,
            {
              [BAB]: path.bab.value,
              ...(path.chapter ? { [CHAP]: path.chapter.value } : {}),
              [SEC]: path.section.value,
            },
            `reselect-section=${path.section.value}`,
          );
        }
        for (const art of path.arts) {
          const number = articleNumber(art.text, art.value);
          if (seen.has(number)) continue;
          const overrides: Record<string, string> = {
            [BAB]: path.bab.value,
            [ART]: art.value,
          };
          if (path.chapter) overrides[CHAP] = path.chapter.value;
          if (path.section) overrides[SEC] = path.section.value;
          html = await this.postback(
            html,
            ART,
            overrides,
            `article=${number}`,
          );
          const text = articleText(html);
          if (!text) {
            continue;
          }
          seen.add(number);
          articles.push({
            number,
            text,
            bab: path.bab.text,
            chapter: path.chapter?.text,
            section: path.section?.text,
            label: art.text,
          });
        }
      }
    }

    return {
      sourceUrl: PARLIAMENT_CONSTITUTION_URL,
      retrievedAt: new Date().toISOString(),
      hostname,
      title: "دستور جمهورية مصر العربية",
      preamble,
      articles,
      rawHtmlHash: initialHtmlHash,
      robotsNote: robots.note,
    };
  }

  private async postback(
    html: string,
    eventTarget: string,
    overrides: Record<string, string>,
    step = "postback",
  ) {
    const fields = extractInputs(html);
    const { selected } = extractSelects(html);
    for (const [name, value] of Object.entries(selected)) {
      fields[name] = value;
    }
    fields.__EVENTTARGET = eventTarget;
    fields.__EVENTARGUMENT = "";
    for (const [key, value] of Object.entries(overrides)) {
      fields[key] = value;
    }
    const body = Object.entries(fields)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");
    const response = await this.post(PARLIAMENT_CONSTITUTION_URL, body);
    return this.read(response, step);
  }

  private async read(response: Response, step = "read") {
    const body = await response.text();
    const restriction = this.evaluateResponse(
      response.status,
      body,
      response.url,
    );
    if (restriction.restricted) {
      throw new Error(
        `${restriction.accessStatus || "ACCESS_RESTRICTED"}: ${restriction.reason} during ${step}`,
      );
    }
    if (!body.includes("ContentPlaceHolder1_DropDownList1") && step !== "robots") {
      throw new Error(
        `ACCESS_RESTRICTED: Constitution controls missing during ${step}`,
      );
    }
    return body;
  }
}

export function createParliamentConstitutionAdapter(
  deps: ParliamentConstitutionFetchDeps = {},
) {
  return new ParliamentConstitutionAdapter(deps);
}
