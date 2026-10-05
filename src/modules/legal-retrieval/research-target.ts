import type { LegalDocumentType } from "@/modules/legal-corpus/types";
import type { RetrievalIntent } from "@/modules/legal-retrieval/resolve-intent";

/** How the final answer should be produced from validated evidence. */
export type AnswerMode = "synthesize" | "exact_text";

/**
 * Explicit research target produced before retrieval/answer generation.
 * Downstream agents should not re-infer these fields independently.
 */
export type ResearchTarget = {
  jurisdiction: string | null;
  document: string | null;
  documentType?: LegalDocumentType;
  legalIssue: string;
  targetArticles: string[];
  answerMode: AnswerMode;
  /** Fully resolved natural-language request for planning/retrieval. */
  resolvedRequest: string;
  /** Corpus-oriented search string. */
  retrievalQuery: string;
};

export function researchTargetFromIntent(
  intent: RetrievalIntent,
  overrides: Partial<ResearchTarget> = {},
): ResearchTarget {
  return {
    jurisdiction: overrides.jurisdiction ?? intent.jurisdiction ?? null,
    document: overrides.document ?? intent.documentLabel ?? null,
    documentType: overrides.documentType ?? intent.documentType,
    legalIssue: overrides.legalIssue ?? intent.userGoal,
    targetArticles: overrides.targetArticles ?? intent.articleNumbers,
    answerMode: overrides.answerMode ?? intent.answerMode ?? "synthesize",
    resolvedRequest:
      overrides.resolvedRequest ?? intent.resolvedRequest ?? intent.userGoal,
    retrievalQuery: overrides.retrievalQuery ?? intent.retrievalQuery,
  };
}

export function mergeIntentWithTarget(
  intent: RetrievalIntent,
  target: ResearchTarget,
): RetrievalIntent {
  return {
    ...intent,
    retrievalQuery: target.retrievalQuery || intent.retrievalQuery,
    articleNumbers: target.targetArticles.length
      ? target.targetArticles
      : intent.articleNumbers,
    documentType: target.documentType ?? intent.documentType,
    userGoal: target.legalIssue || intent.userGoal,
    jurisdiction: target.jurisdiction,
    documentLabel: target.document,
    answerMode: target.answerMode,
    resolvedRequest: target.resolvedRequest,
  };
}

export function describeResearchTarget(target: ResearchTarget): string[] {
  const steps: string[] = [];
  if (target.document) {
    steps.push(`Identified: ${target.document}`);
  } else if (target.documentType === "CONSTITUTION") {
    steps.push("Identified: Constitution");
  }
  if (target.jurisdiction) {
    steps.push(`Jurisdiction: ${target.jurisdiction}`);
  }
  if (target.targetArticles.length === 1) {
    steps.push(`Identified target: Article ${target.targetArticles[0]}`);
  } else if (target.targetArticles.length > 1) {
    steps.push(
      `Identified targets: Articles ${target.targetArticles.join(", ")}`,
    );
  }
  if (target.answerMode === "exact_text") {
    steps.push("Answer mode: exact text");
  }
  return steps;
}
