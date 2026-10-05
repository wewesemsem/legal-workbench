import { getAgentModelGateway } from "@/modules/agents/model-gateway";
import type { LegalDocumentType } from "@/modules/legal-corpus/types";
import { detectLegalReferences } from "@/modules/legal-retrieval/references";
import type { AnswerMode } from "@/modules/legal-retrieval/research-target";
import type { LegalSearchFilters } from "@/modules/legal-retrieval/types";

const DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  "CONSTITUTION",
  "LEGISLATION",
  "REGULATION",
  "JUDGMENT",
  "JUDGMENT_SUMMARY",
  "CONSTITUTIONAL_JUDGMENT",
  "LEGISLATIVE_HISTORY",
  "PARLIAMENTARY_DOCUMENT",
  "OFFICIAL_DECISION",
  "HISTORICAL_LEGAL_MATERIAL",
  "OTHER",
]);

export type RetrievalIntent = {
  /** Original user wording. */
  originalQuery: string;
  /** Corpus-oriented search string (may include Arabic / explicit articles). */
  retrievalQuery: string;
  /** Inferred provision numbers for exact lookup (hypotheses only). */
  articleNumbers: string[];
  /** Optional document-type filter when clearly implied. */
  documentType?: LegalDocumentType;
  /** What to answer once evidence exists. */
  userGoal: string;
  source: "ai" | "passthrough" | "conversation";
  /** Optional jurisdiction label (e.g. Egypt). */
  jurisdiction?: string | null;
  /** Optional human document label (e.g. Egyptian Constitution). */
  documentLabel?: string | null;
  /** How the answer should be produced from validated evidence. */
  answerMode?: AnswerMode;
  /** Fully resolved request after conversation context resolution. */
  resolvedRequest?: string;
};

const INTENT_SCHEMA = `{
  "retrievalQuery": "string — concrete corpus search string (Arabic OK; include Article N / المادة N when targeting a provision)",
  "articleNumbers": ["string — inferred article/provision numbers to look up exactly, else []"],
  "documentType": "CONSTITUTION|LEGISLATION|REGULATION|JUDGMENT|null",
  "userGoal": "string — short statement of what the user wants answered",
  "jurisdiction": "string|null — e.g. Egypt",
  "documentLabel": "string|null — e.g. Egyptian Constitution",
  "answerMode": "synthesize|exact_text"
}`;

function uniqueArticles(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseDocumentType(value: unknown): LegalDocumentType | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (!DOCUMENT_TYPES.has(normalized)) return undefined;
  return normalized as LegalDocumentType;
}

function detectAnswerMode(query: string): AnswerMode {
  if (
    /\b(first\s+sentence|exact\s+(wording|text|language)|quote|verbatim|what\s+does\s+article\b|ماذا\s+تقول|نص\s+المادة|أول\s+جملة)\b/i.test(
      query,
    )
  ) {
    return "exact_text";
  }
  return "synthesize";
}

function passthroughIntent(query: string): RetrievalIntent {
  const references = detectLegalReferences(query);
  const openingArticle =
    /\b(first\s+sentence|opening\s+(sentence|text|words)|beginning\s+of|أول\s+جملة)\b/i.test(
      query,
    ) && references.mentionsConstitution
      ? ["1"]
      : [];
  const egyptian =
    /\b(egypt|egyptian|مصر|المصري|المصرية)\b/i.test(query) ||
    (references.mentionsConstitution &&
      !/\b(u\.?s\.?a?\.?\b|united\s+states|american)\b/i.test(query));
  return {
    originalQuery: query,
    retrievalQuery: query,
    articleNumbers: [...new Set([...references.articleNumbers, ...openingArticle])],
    documentType: references.mentionsConstitution ? "CONSTITUTION" : undefined,
    userGoal: query,
    source: "passthrough",
    jurisdiction: egyptian ? "Egypt" : null,
    documentLabel: references.mentionsConstitution
      ? egyptian
        ? "Egyptian Constitution"
        : "Constitution"
      : null,
    answerMode: detectAnswerMode(query),
    resolvedRequest: query,
  };
}

/**
 * Parse model JSON into a RetrievalIntent. Exported for unit tests.
 */
export function parseRetrievalIntent(
  raw: Record<string, unknown> | null | undefined,
  originalQuery: string,
): RetrievalIntent | null {
  if (!raw || typeof raw !== "object") return null;

  const retrievalQuery =
    typeof raw.retrievalQuery === "string" ? raw.retrievalQuery.trim() : "";
  if (!retrievalQuery || retrievalQuery.length > 4_000) return null;

  const fromModel = Array.isArray(raw.articleNumbers)
    ? raw.articleNumbers.filter((item): item is string => typeof item === "string")
    : [];
  const fromResolvedQuery = detectLegalReferences(retrievalQuery).articleNumbers;
  const fromOriginal = detectLegalReferences(originalQuery).articleNumbers;
  const articleNumbers = uniqueArticles([
    ...fromOriginal,
    ...fromResolvedQuery,
    ...fromModel,
  ]);

  const documentType =
    parseDocumentType(raw.documentType) ??
    (detectLegalReferences(retrievalQuery).mentionsConstitution ||
    detectLegalReferences(originalQuery).mentionsConstitution
      ? "CONSTITUTION"
      : undefined);

  const userGoal =
    typeof raw.userGoal === "string" && raw.userGoal.trim()
      ? raw.userGoal.trim().slice(0, 2_000)
      : originalQuery;

  const jurisdiction =
    typeof raw.jurisdiction === "string" && raw.jurisdiction.trim()
      ? raw.jurisdiction.trim().slice(0, 120)
      : passthroughIntent(originalQuery).jurisdiction;

  const documentLabel =
    typeof raw.documentLabel === "string" && raw.documentLabel.trim()
      ? raw.documentLabel.trim().slice(0, 240)
      : passthroughIntent(originalQuery).documentLabel;

  const answerModeRaw =
    typeof raw.answerMode === "string" ? raw.answerMode.trim().toLowerCase() : "";
  const answerMode: AnswerMode =
    answerModeRaw === "exact_text"
      ? "exact_text"
      : answerModeRaw === "synthesize"
        ? "synthesize"
        : detectAnswerMode(`${originalQuery}\n${userGoal}\n${retrievalQuery}`);

  return {
    originalQuery,
    retrievalQuery,
    articleNumbers,
    documentType,
    userGoal,
    source: "ai",
    jurisdiction,
    documentLabel,
    answerMode,
    resolvedRequest: userGoal,
  };
}

/**
 * LLM intent → retrieval targets. Never answers the legal question itself.
 * Falls back to passthrough when mock / unavailable / invalid.
 */
export async function resolveRetrievalIntent(query: string): Promise<RetrievalIntent> {
  const trimmed = query.trim();
  if (!trimmed) {
    return passthroughIntent(query);
  }

  const fallback = passthroughIntent(trimmed);

  try {
    // Mock gateway returns null → passthrough. Tests may stub structuredOutput.
    const proposed = await getAgentModelGateway().structuredOutput({
      system: [
        "You resolve natural-language legal research questions into concrete retrieval targets.",
        "You do NOT answer the legal question and you do NOT invent statute text.",
        "articleNumbers are lookup hypotheses for the indexed corpus only.",
        "Prefer the smallest precise target (specific article/provision over broad topic search).",
        "When the user asks for opening or initial text of a named instrument, target its first operative provision",
        "(usually Article 1 / المادة 1) and set documentType when clearly implied.",
        "For exact wording / first sentence / quote questions, set answerMode to exact_text.",
        "Prefer Egyptian jurisdiction and Egyptian Constitution when a constitution is implied without another country.",
        "When the user asks about a topic, leave articleNumbers empty and write a tight retrievalQuery.",
        "Return ONLY JSON matching the schema.",
      ].join(" "),
      instructions:
        "Resolve USER wording into retrievalQuery + optional articleNumbers/documentType/jurisdiction/answerMode. No chain-of-thought.",
      task: trimmed,
      matterContext: "Egyptian legal workbench; prefer primary Egyptian instruments when implied.",
      evidence: "(none — intent resolution stage)",
      toolResults: "(none)",
      schemaHint: INTENT_SCHEMA,
    });

    const parsed = parseRetrievalIntent(proposed, trimmed);
    if (!parsed) {
      return fallback;
    }
    return parsed;
  } catch (error) {
    console.warn("[legal-retrieval] intent resolve unavailable; using passthrough", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return fallback;
  }
}

/**
 * Choose the corpus search query given a tool/model query and optional resolved intent.
 * Prefer the model's rewrite when it differs from the raw user task; otherwise use intent.
 */
export function corpusQueryFromIntent(input: {
  toolQuery: string;
  userTask: string;
  intent?: RetrievalIntent | null;
}): string {
  const toolQuery = input.toolQuery.trim();
  const userTask = input.userTask.trim();
  const intentQuery = input.intent?.retrievalQuery?.trim();
  if (!intentQuery) return toolQuery || userTask;

  const toolLooksRaw =
    !toolQuery ||
    toolQuery.toLowerCase() === userTask.toLowerCase() ||
    toolQuery.toLowerCase() === input.intent?.originalQuery.toLowerCase();

  if (toolLooksRaw) {
    return intentQuery;
  }
  return toolQuery;
}

/** Build searchLegalCorpus args from a resolved intent. */
export function searchArgsFromIntent(
  intent: RetrievalIntent,
  input: {
    filters?: LegalSearchFilters;
    limit?: number;
    debug?: boolean;
  } = {},
) {
  // Prefer country (ISO) over free-text jurisdiction — corpus rows store country=EG
  // and jurisdiction labels vary ("Egypt", etc.).
  const country =
    input.filters?.country ??
    (intent.jurisdiction && /egypt/i.test(intent.jurisdiction) ? "EG" : undefined);

  return {
    query: intent.retrievalQuery,
    articleNumbers: intent.articleNumbers,
    documentType: intent.documentType,
    filters: {
      ...input.filters,
      documentType: intent.documentType ?? input.filters?.documentType,
      ...(country ? { country } : {}),
    },
    limit: input.limit,
    debug: input.debug,
  };
}
