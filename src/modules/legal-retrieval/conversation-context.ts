import type { LegalDocumentType } from "@/modules/legal-corpus/types";
import { detectLegalReferences } from "@/modules/legal-retrieval/references";
import type {
  AnswerMode,
  ResearchTarget,
} from "@/modules/legal-retrieval/research-target";

export type ConversationRole = "user" | "assistant";

export type ConversationMessage = {
  role: ConversationRole;
  content: string;
};

export type TurnRelation =
  | "new"
  | "follow_up"
  | "correction"
  | "clarification";

export type ActiveResearchContext = {
  jurisdiction: string | null;
  document: string | null;
  documentType?: LegalDocumentType;
  legalQuestion: string | null;
  targetArticles: string[];
  answerMode: AnswerMode;
  previousAnswerRejected: boolean;
};

export type ResolvedConversationContext = {
  relation: TurnRelation;
  active: ActiveResearchContext;
  target: ResearchTarget;
  /** High-level process steps for the research UI. */
  processSteps: string[];
};

const CORRECTION_RE =
  /^\s*(no\b|nope\b|nah\b|actually\b|i\s*mean\b|i'm\s+talking\s+about\b|im\s+talking\s+about\b|not\s+the\b|wrong\b|correction\b|instead\b)/i;

const CLARIFICATION_ONLY_RE =
  /^\s*(the\s+)?(egyptian|egypt|us|u\.?s\.?|american|united\s+states)?\s*(constitution|دستور)[\s.!?]*$/i;

const FOLLOW_UP_RE =
  /^\s*(what\s+about\b|and\s+(article|المادة)\b|how\s+about\b|same\s+(for|with)\b|also\b|that\s+(article|one)\b|the\s+previous\b)/i;

const EXACT_TEXT_RE =
  /\b(first\s+sentence|exact\s+(wording|text|language)|quote|verbatim|what\s+does\s+article\b|ماذا\s+تقول|نص\s+المادة|أول\s+جملة)\b/i;

const OPENING_TEXT_RE =
  /\b(first\s+sentence|opening\s+(sentence|text|words)|beginning\s+of|start\s+of|أول\s+جملة|الجملة\s+الأولى)\b/i;

const EGYPT_RE =
  /\b(egypt|egyptian|مصر|المصري|المصرية)\b/i;
const US_RE =
  /\b(u\.?s\.?a?\.?\b|united\s+states|american)\b/i;

function emptyActive(): ActiveResearchContext {
  return {
    jurisdiction: null,
    document: null,
    documentType: undefined,
    legalQuestion: null,
    targetArticles: [],
    answerMode: "synthesize",
    previousAnswerRejected: false,
  };
}

function uniqueArticles(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function detectJurisdiction(text: string): string | null {
  if (EGYPT_RE.test(text)) return "Egypt";
  if (US_RE.test(text)) return "United States";
  return null;
}

function detectDocumentLabel(
  text: string,
  jurisdiction: string | null,
  documentType?: LegalDocumentType,
): string | null {
  const refs = detectLegalReferences(text);
  if (refs.mentionsConstitution || documentType === "CONSTITUTION") {
    if (jurisdiction === "Egypt" || EGYPT_RE.test(text)) {
      return "Egyptian Constitution";
    }
    if (jurisdiction === "United States" || US_RE.test(text)) {
      return "United States Constitution";
    }
    return "Constitution";
  }
  return null;
}

function detectAnswerMode(text: string): AnswerMode {
  if (EXACT_TEXT_RE.test(text) || OPENING_TEXT_RE.test(text)) {
    return "exact_text";
  }
  return "synthesize";
}

function inferOpeningArticles(text: string): string[] {
  if (!OPENING_TEXT_RE.test(text)) return [];
  // Opening / first sentence of a constitution maps to Article 1.
  if (detectLegalReferences(text).mentionsConstitution || /\bconstitution\b/i.test(text) || text.includes("الدستور")) {
    return ["1"];
  }
  return ["1"];
}

function classifyRelation(
  message: string,
  history: ConversationMessage[],
): TurnRelation {
  if (!history.length) return "new";
  if (CORRECTION_RE.test(message)) return "correction";
  if (CLARIFICATION_ONLY_RE.test(message.trim())) return "clarification";
  if (FOLLOW_UP_RE.test(message)) return "follow_up";

  const refs = detectLegalReferences(message);
  const short =
    message.trim().split(/\s+/).length <= 12 &&
    (Boolean(detectJurisdiction(message)) || refs.mentionsConstitution);
  if (short && history.some((item) => item.role === "user")) {
    // Short jurisdiction/document-only message after a prior question.
    if (!refs.hasExplicitArticleReference && !/\?/.test(message)) {
      return "clarification";
    }
  }

  // Article-only follow-up that omits the instrument name.
  if (
    refs.hasExplicitArticleReference &&
    !refs.mentionsConstitution &&
    !detectJurisdiction(message) &&
    history.some((item) => item.role === "user")
  ) {
    return "follow_up";
  }

  return "new";
}

/**
 * Replay prior user turns so corrections/follow-ups accumulate into active state.
 */
function extractPriorActive(history: ConversationMessage[]): ActiveResearchContext {
  let active = emptyActive();
  const seen: ConversationMessage[] = [];

  for (const message of history) {
    seen.push(message);
    if (message.role !== "user") continue;

    const prior = seen.slice(0, -1);
    const relation = classifyRelation(message.content, prior);
    if (relation === "new") {
      active = emptyActive();
      applyUserMessageToActive(active, message.content, "new");
    } else {
      applyUserMessageToActive(active, message.content, relation);
    }
  }

  return active;
}

function applyUserMessageToActive(
  active: ActiveResearchContext,
  message: string,
  relation: TurnRelation,
): void {
  const refs = detectLegalReferences(message);
  const jurisdiction = detectJurisdiction(message);
  if (jurisdiction) {
    active.jurisdiction = jurisdiction;
  }

  if (refs.mentionsConstitution) {
    active.documentType = "CONSTITUTION";
  }

  const document = detectDocumentLabel(
    message,
    active.jurisdiction,
    active.documentType,
  );
  if (document) {
    active.document = document;
  }

  const openingArticles = inferOpeningArticles(message);
  const articles = uniqueArticles([
    ...refs.articleNumbers,
    ...openingArticles,
  ]);

  if (relation === "correction" || relation === "clarification") {
    // Keep the prior legal question / task; update document/jurisdiction/articles
    // only when newly specified.
    if (articles.length) {
      active.targetArticles = articles;
    }
    active.previousAnswerRejected = true;
  } else if (relation === "follow_up") {
    if (articles.length) {
      active.targetArticles = articles;
    }
    const mode = detectAnswerMode(message);
    if (mode === "exact_text") {
      active.answerMode = "exact_text";
    }
    // Preserve legalQuestion shell; article changes rewrite resolved request later.
  } else {
    // New question — reset task fields but keep nothing from prior unless
    // this is truly a brand-new turn with no history merge.
    active.legalQuestion = message.trim();
    active.targetArticles = articles;
    active.answerMode = detectAnswerMode(message);
    active.previousAnswerRejected = false;
    if (!active.jurisdiction && refs.mentionsConstitution) {
      // Egyptian legal workbench default when the instrument is a constitution
      // and no competing jurisdiction was named.
      active.jurisdiction = "Egypt";
      active.document =
        detectDocumentLabel(message, "Egypt", "CONSTITUTION") ??
        "Egyptian Constitution";
      active.documentType = "CONSTITUTION";
    }
  }

  if (relation === "correction" || relation === "clarification") {
    if (!active.legalQuestion) {
      // Fall back to the clarifying message itself if somehow empty.
      active.legalQuestion = message.trim();
    }
    if (detectAnswerMode(active.legalQuestion) === "exact_text") {
      active.answerMode = "exact_text";
    }
    if (
      active.documentType === "CONSTITUTION" &&
      !active.targetArticles.length &&
      OPENING_TEXT_RE.test(active.legalQuestion)
    ) {
      active.targetArticles = ["1"];
    }
  }
}

function buildResolvedRequest(active: ActiveResearchContext): string {
  const parts: string[] = [];
  const question = active.legalQuestion?.trim() || "Answer the legal research question";

  if (active.targetArticles.length === 1) {
    const article = active.targetArticles[0];
    if (active.document) {
      if (active.answerMode === "exact_text") {
        if (OPENING_TEXT_RE.test(question) && article === "1") {
          parts.push(
            `What is the first sentence of ${active.document}? (Article ${article})`,
          );
        } else {
          parts.push(
            `What does Article ${article} of ${active.document} say exactly?`,
          );
        }
      } else {
        parts.push(
          `Regarding ${active.document}, Article ${article}: ${question}`,
        );
      }
    } else if (active.jurisdiction) {
      parts.push(
        `In ${active.jurisdiction}, what does Article ${article} say? ${question}`,
      );
    } else {
      parts.push(question);
    }
  } else if (active.document) {
    // Preserve the user's task wording but pin the document.
    if (/constitution/i.test(question) || question.includes("الدستور")) {
      parts.push(
        question.replace(/\bthe constitution\b/gi, active.document),
      );
    } else {
      parts.push(`${question} (${active.document})`);
    }
  } else if (active.jurisdiction) {
    parts.push(`${question} (jurisdiction: ${active.jurisdiction})`);
  } else {
    parts.push(question);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function buildRetrievalQuery(active: ActiveResearchContext): string {
  const bits: string[] = [];
  if (active.document) bits.push(active.document);
  else if (active.jurisdiction) bits.push(active.jurisdiction);
  if (active.targetArticles.length) {
    bits.push(
      ...active.targetArticles.map((number) => `Article ${number}`),
    );
  } else if (active.legalQuestion) {
    bits.push(active.legalQuestion);
  }
  return bits.join(" ").trim() || active.legalQuestion || "";
}

function buildLegalIssue(active: ActiveResearchContext): string {
  if (active.answerMode === "exact_text" && active.targetArticles.length === 1) {
    if (
      active.legalQuestion &&
      OPENING_TEXT_RE.test(active.legalQuestion) &&
      active.targetArticles[0] === "1"
    ) {
      return `Identify the first sentence of ${active.document ?? "the constitution"} (Article 1)`;
    }
    return `Quote the exact text of Article ${active.targetArticles[0]}`;
  }
  return active.legalQuestion?.trim() || buildResolvedRequest(active);
}

/**
 * Resolve the current user message against prior turns into a structured
 * research target. Deterministic — does not call an LLM.
 */
export function resolveConversationContext(input: {
  message: string;
  history?: ConversationMessage[];
}): ResolvedConversationContext {
  const message = input.message.trim();
  const history = input.history ?? [];
  const relation = classifyRelation(message, history);

  const active =
    relation === "new" && history.length === 0
      ? emptyActive()
      : extractPriorActive(history);

  if (relation === "new" && history.length > 0) {
    // Brand-new question in an existing thread — reset task state but allow
    // explicit cues in the new message to set document/jurisdiction.
    const reset = emptyActive();
    applyUserMessageToActive(reset, message, "new");
    return finalize(reset, relation, message);
  }

  if (relation === "new") {
    applyUserMessageToActive(active, message, "new");
    return finalize(active, relation, message);
  }

  // Follow-up / correction / clarification — merge onto prior active context.
  applyUserMessageToActive(active, message, relation);
  return finalize(active, relation, message);
}

function finalize(
  active: ActiveResearchContext,
  relation: TurnRelation,
  rawMessage: string,
): ResolvedConversationContext {
  // Default Egyptian constitution for constitution questions in this workbench
  // when still unspecified after merge.
  if (
    active.documentType === "CONSTITUTION" &&
    !active.jurisdiction &&
    !US_RE.test(rawMessage)
  ) {
    active.jurisdiction = "Egypt";
    active.document = active.document ?? "Egyptian Constitution";
  }

  const resolvedRequest = buildResolvedRequest(active);
  const target: ResearchTarget = {
    jurisdiction: active.jurisdiction,
    document: active.document,
    documentType: active.documentType,
    legalIssue: buildLegalIssue(active),
    targetArticles: active.targetArticles,
    answerMode: active.answerMode,
    resolvedRequest,
    retrievalQuery: buildRetrievalQuery(active),
  };

  const processSteps = ["Understood conversation context"];
  if (relation === "correction" || relation === "clarification") {
    processSteps.push("Applied user correction to active matter");
  } else if (relation === "follow_up") {
    processSteps.push("Resolved follow-up against prior context");
  }
  if (target.document) {
    processSteps.push(`Identified: ${target.document}`);
  }
  if (target.targetArticles.length === 1) {
    processSteps.push(`Identified target: Article ${target.targetArticles[0]}`);
  } else if (target.targetArticles.length > 1) {
    processSteps.push(
      `Identified targets: Articles ${target.targetArticles.join(", ")}`,
    );
  }

  return { relation, active, target, processSteps };
}
