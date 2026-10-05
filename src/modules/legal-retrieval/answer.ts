import { getEnv } from "@/lib/env";
import { getLlmService } from "@/modules/llm";
import {
  citationsForMarkers,
  parseModelAnswer,
  unsupportedArticleNumbers,
} from "@/modules/legal-retrieval/citations";
import {
  buildLegalContext,
  LEGAL_ANSWER_SYSTEM_PROMPT,
} from "@/modules/legal-retrieval/context-builder";
import {
  resolveRetrievalIntent,
  searchArgsFromIntent,
  type RetrievalIntent,
} from "@/modules/legal-retrieval/resolve-intent";
import { searchLegalCorpus } from "@/modules/legal-retrieval/service";
import { orderEvidenceForAnswer } from "@/modules/legal-retrieval/evidence-order";
import { synthesizeFromEvidence } from "@/modules/legal-retrieval/synthesize";
import type { LegalAnswer, LegalEvidence, LegalSearchFilters } from "@/modules/legal-retrieval/types";

function synthesizedAnswer(
  query: string,
  evidence: LegalEvidence[],
  debug: LegalAnswer["debug"],
  answerMode: "synthesize" | "exact_text" = "synthesize",
): LegalAnswer {
  const ordered = orderEvidenceForAnswer(query, evidence);
  const synthesized = synthesizeFromEvidence({
    query,
    evidence: ordered,
    answerMode,
  });
  const citationEvidence =
    answerMode === "exact_text" ? ordered.slice(0, 1) : ordered;
  return {
    answer: synthesized.answer,
    citations: citationsForMarkers(synthesized.markers, citationEvidence),
    evidenceSufficient: true,
    limitation: null,
    debug,
  };
}

export async function askLegalQuestion(input: {
  query: string;
  filters?: LegalSearchFilters;
  limit?: number;
  debug?: boolean;
  /** Optional pre-resolved intent (avoids a second resolve when the caller already has one). */
  intent?: RetrievalIntent;
}): Promise<LegalAnswer> {
  const intent = input.intent ?? (await resolveRetrievalIntent(input.query));
  const search = await searchLegalCorpus(searchArgsFromIntent(intent, input));
  const answerQuery = intent.userGoal || input.query;
  if (!search.evidenceSufficient || search.limitation || search.evidence.length === 0) {
    const message =
      search.limitation?.message ?? "No sufficient indexed legal source found.";
    return {
      answer: message,
      citations: [],
      evidenceSufficient: false,
      limitation: message,
      debug: search.debug,
    };
  }

  const answerMode = intent.answerMode ?? "synthesize";
  // Exact-text answers must stay extractive from retrieved evidence.
  const fallback = synthesizedAnswer(
    answerQuery,
    search.evidence,
    search.debug,
    answerMode,
  );
  if (answerMode === "exact_text" || getEnv().LLM_PROVIDER === "mock") {
    return fallback;
  }

  try {
    const completion = await getLlmService().chat({
      messages: [
        { role: "system", content: LEGAL_ANSWER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `${buildLegalContext(search.evidence)}\n\nQUESTION:\n${answerQuery.trim()}`,
        },
      ],
    });
    const parsed = parseModelAnswer(completion.content);
    const requested = parsed.markers.filter((marker) => /^S\d+$/.test(marker));
    const citations = citationsForMarkers(requested, search.evidence);
    const unsupported = unsupportedArticleNumbers(parsed.answer, search.evidence);
    const dropped = requested.length !== citations.length;
    if (unsupported.length || citations.length === 0 || dropped) {
      return fallback;
    }
    return {
      answer: parsed.answer,
      citations,
      evidenceSufficient: true,
      limitation: null,
      debug: search.debug,
    };
  } catch (error) {
    console.error("[legal-retrieval] answer model failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return fallback;
  }
}
