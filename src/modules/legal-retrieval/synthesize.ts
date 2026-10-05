import { provisionLabel } from "@/modules/legal-retrieval/citations";
import { orderEvidenceForAnswer } from "@/modules/legal-retrieval/evidence-order";
import type { AnswerMode } from "@/modules/legal-retrieval/research-target";
import { authorityBadgeLabel } from "@/modules/legal-retrieval/web/classify";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";

function shortQuote(text: string, maxChars = 280): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) {
    return compact;
  }
  return `${compact.slice(0, maxChars).trim()}…`;
}

function firstSentence(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const match = compact.match(/^(.+?[.!?۔؟])(?:\s|$)/);
  return match?.[1]?.trim() || compact;
}

function synthesizeExactText(input: {
  query: string;
  evidence: LegalEvidence[];
}): { answer: string; markers: string[] } {
  const ordered = orderEvidenceForAnswer(input.query, input.evidence);
  const primary = ordered[0];
  if (!primary) {
    return {
      answer:
        "The requested provision was not retrieved. Evidence is insufficient to quote the exact text.",
      markers: [],
    };
  }

  const label = provisionLabel(primary);
  const wantsFirstSentence =
    /\b(first\s+sentence|opening\s+sentence|أول\s+جملة|الجملة\s+الأولى)\b/i.test(
      input.query,
    );
  const quoted = wantsFirstSentence
    ? firstSentence(primary.text)
    : primary.text.replace(/\s+/g, " ").trim();

  const documentBit = primary.title ? ` of ${primary.title}` : "";
  const lead = wantsFirstSentence
    ? `The first sentence of ${label}${documentBit} is:`
    : `The exact text of ${label}${documentBit} is:`;
  const answer = [lead, "", `«${quoted}» [S1]`].join("\n");

  return { answer, markers: ["S1"] };
}

/**
 * Deterministic grounded synthesis used when no chat LLM is configured.
 * Stays extractive enough to avoid inventing law, but produces a readable
 * multi-source answer instead of an undifferentiated quote dump.
 */
export function synthesizeFromEvidence(input: {
  query: string;
  evidence: LegalEvidence[];
  corpusLimitation?: string | null;
  answerMode?: AnswerMode;
}): { answer: string; markers: string[] } {
  if (input.answerMode === "exact_text") {
    return synthesizeExactText(input);
  }

  const ordered = orderEvidenceForAnswer(input.query, input.evidence);
  const selected = ordered.slice(0, 5);
  const markers = selected.map((_, index) => `S${index + 1}`);
  const corpus = selected.filter((item) => item.sourceKind === "LEGAL_CORPUS");
  const web = selected.filter((item) => item.sourceKind === "WEB_RESEARCH");

  const lines: string[] = ["Answer", ""];

  if (input.corpusLimitation && web.length) {
    lines.push(input.corpusLimitation);
    lines.push("");
    lines.push(
      "I searched publicly accessible sources and found the following additional sources.",
    );
    lines.push("");
  }

  if (corpus.length) {
    const documentTitle = corpus[0]?.title ?? "the retrieved legal source";
    lines.push(`Based on the indexed legal corpus (${documentTitle}):`);
    lines.push("");
    for (const item of corpus) {
      const index = selected.indexOf(item);
      const marker = `S${index + 1}`;
      const label = provisionLabel(item);
      const verb =
        item.documentType === "CONSTITUTION"
          ? "The Constitution provides"
          : "The source provides";
      lines.push(`${verb} in ${label} [${marker}]: «${shortQuote(item.text)}»`);
      lines.push("");
    }
  } else if (!web.length) {
    lines.push("No sufficient evidence was retrieved to answer this question.");
    lines.push("");
  } else {
    lines.push("Based only on retrieved web sources (not the indexed legal corpus):");
    lines.push("");
  }

  if (corpus.length) {
    lines.push("Key legal authorities");
    lines.push("");
    for (const item of corpus) {
      const index = selected.indexOf(item);
      lines.push(
        `• ${provisionLabel(item)} — ${item.title} [${`S${index + 1}`}]`,
      );
    }
    lines.push("");
  }

  if (web.length) {
    lines.push("Additional research");
    lines.push("");
    for (const item of web) {
      const index = selected.indexOf(item);
      const badge = item.webAuthority
        ? authorityBadgeLabel(item.webAuthority)
        : "GENERAL WEB";
      lines.push(
        `• ${badge} — ${item.sourceName ?? item.domain ?? "Web"} — ${item.title} [${`S${index + 1}`}]`,
      );
      lines.push(`  «${shortQuote(item.text, 180)}»`);
    }
    lines.push("");
  }

  const caveats: string[] = [];
  if (input.corpusLimitation) {
    caveats.push(
      "The indexed Egyptian legal corpus does not currently contain sufficient evidence for this question; web material is not automatically authoritative.",
    );
  }
  if (web.length && !corpus.length) {
    caveats.push(
      "Web sources are research findings only and are not ingested into the permanent legal corpus.",
    );
  }
  if (web.some((item) => item.webAuthority === "SECONDARY_LEGAL" || item.webAuthority === "GENERAL_WEB" || item.webAuthority === "ACADEMIC")) {
    caveats.push(
      "Secondary or general web sources must not be treated as primary official law.",
    );
  }
  if (caveats.length) {
    lines.push("Caveat");
    lines.push("");
    for (const caveat of caveats) {
      lines.push(caveat);
    }
    lines.push("");
  }

  lines.push(
    "Source-supported: every claim above is tied to a retrieved evidence marker. No invented URLs or authorities are offered here.",
  );

  return {
    answer: lines.join("\n").trim(),
    markers,
  };
}
