import { runAgentControlLoop } from "@/modules/agents/agents/control-loop";
import type { AgentRuntime, LegalAgent } from "@/modules/agents/agents/base";
import { recordStep } from "@/modules/agents/agents/base";
import {
  RESEARCH_AGENT_INSTRUCTIONS,
  SHARED_AGENT_SYSTEM,
} from "@/modules/agents/prompts";
import type {
  AgentDefinition,
  AgentResult,
  ConfidenceLevel,
  ResearchAgentOutput,
} from "@/modules/agents/types";
import { validateEvidenceAgainstTarget } from "@/modules/legal-retrieval/evidence-validation";
import { orderEvidenceForAnswer } from "@/modules/legal-retrieval/evidence-order";
import {
  mergeIntentWithTarget,
  researchTargetFromIntent,
  type ResearchTarget,
} from "@/modules/legal-retrieval/research-target";
import {
  resolveRetrievalIntent,
  searchArgsFromIntent,
} from "@/modules/legal-retrieval/resolve-intent";
import { answerFromRetrievedEvidence } from "@/modules/legal-retrieval/research";
import { searchLegalCorpus } from "@/modules/legal-retrieval/service";
import type { LegalCitation, LegalEvidence } from "@/modules/legal-retrieval/types";

const DEFINITION: AgentDefinition = {
  id: "RESEARCH",
  name: "Research Agent",
  description: "Searches legal corpus and web sources for grounded authorities.",
  capabilities: [
    "search_legal_corpus",
    "search_web",
    "dynamic_tool_calling",
    "retrieve_citations",
    "produce_research_memo",
  ],
  systemInstructions: `${SHARED_AGENT_SYSTEM}\n\n${RESEARCH_AGENT_INSTRUCTIONS}`,
  allowedTools: [
    "search_legal_corpus",
    "search_web",
    "retrieve_legal_provision",
    "retrieve_web_source",
    "build_legal_context",
    "retrieve_memory",
    "propose_memory",
  ],
};

function confidenceFromEvidence(count: number): ConfidenceLevel {
  if (count >= 5) return "HIGH";
  if (count >= 2) return "MEDIUM";
  return "LOW";
}

function researchEvidence(contextEvidence: LegalEvidence[]): LegalEvidence[] {
  return contextEvidence.filter(
    (item) =>
      item.sourceKind === "LEGAL_CORPUS" || item.sourceKind === "WEB_RESEARCH",
  );
}

function buildAuthorities(evidence: LegalEvidence[]): ResearchAgentOutput["authorities"] {
  return evidence.slice(0, 12).map((item) => ({
    source_type:
      item.sourceKind === "WEB_RESEARCH" ? "WEB_RESEARCH" : "LEGAL_CORPUS",
    title: item.title,
    article: item.provisionNumber,
    evidence: item.text.slice(0, 500),
    citation_id: item.chunkId,
    source_url: item.sourceUrl,
    authority_level: item.webAuthority ?? item.authorityStatus,
    date: item.publishedAt ?? item.date,
  }));
}

function buildWebSources(evidence: LegalEvidence[]): ResearchAgentOutput["web_sources"] {
  return evidence
    .filter((item) => item.sourceKind === "WEB_RESEARCH" && item.sourceUrl)
    .map((item) => ({
      title: item.title,
      url: item.sourceUrl!,
      domain: item.domain ?? "",
      authority_status: String(item.webAuthority ?? item.authorityStatus),
      excerpt: item.text.slice(0, 400),
    }));
}

function mergeCitations(
  existing: LegalCitation[],
  next: LegalCitation[],
): LegalCitation[] {
  const merged = [...existing];
  for (const citation of next) {
    if (
      !merged.some(
        (item) =>
          item.marker === citation.marker ||
          item.legalChunkId === citation.legalChunkId,
      )
    ) {
      merged.push(citation);
    }
  }
  return merged;
}

async function retryTargetedRetrieval(target: ResearchTarget): Promise<LegalEvidence[]> {
  if (!target.targetArticles.length && !target.retrievalQuery) {
    return [];
  }
  const intent = mergeIntentWithTarget(
    {
      originalQuery: target.resolvedRequest,
      retrievalQuery: target.retrievalQuery,
      articleNumbers: target.targetArticles,
      documentType: target.documentType,
      userGoal: target.legalIssue,
      source: "conversation",
      jurisdiction: target.jurisdiction,
      documentLabel: target.document,
      answerMode: target.answerMode,
      resolvedRequest: target.resolvedRequest,
    },
    target,
  );
  const result = await searchLegalCorpus(searchArgsFromIntent(intent));
  return result.evidence;
}

export function createResearchAgent(runtime: AgentRuntime): LegalAgent {
  return {
    definition: DEFINITION,
    async execute(context, task): Promise<AgentResult> {
      const priorTarget = context.researchTarget ?? null;
      const intent = await resolveRetrievalIntent(
        priorTarget?.resolvedRequest || task,
      );
      const target = priorTarget
        ? {
            ...priorTarget,
            // Prefer conversation-resolved articles/document; fill gaps from intent.
            targetArticles: priorTarget.targetArticles.length
              ? priorTarget.targetArticles
              : intent.articleNumbers,
            documentType: priorTarget.documentType ?? intent.documentType,
            answerMode: priorTarget.answerMode ?? intent.answerMode ?? "synthesize",
            retrievalQuery:
              priorTarget.retrievalQuery || intent.retrievalQuery,
            legalIssue: priorTarget.legalIssue || intent.userGoal,
          }
        : researchTargetFromIntent(intent);

      const mergedIntent = mergeIntentWithTarget(intent, target);
      context.retrievalIntent = mergedIntent;
      context.researchTarget = target;

      await recordStep({
        context,
        runtime,
        agentType: "RESEARCH",
        action: "research.target",
        outputMetadata: {
          summary: target.targetArticles.length
            ? `Research target: ${target.document ?? target.documentType ?? "instrument"}${
                target.targetArticles.length
                  ? ` · Article ${target.targetArticles.join(", ")}`
                  : ""
              }`
            : `Research target: ${target.document ?? target.legalIssue}`,
          researchTarget: target,
        },
      });

      const loopResult = await runAgentControlLoop({
        context,
        runtime,
        agent: DEFINITION,
        task: target.resolvedRequest || task,
        buildFinalResult: ({ incomplete }) => {
          const evidence = researchEvidence(context.retrievedEvidence);
          const summary = evidence.length
            ? `Found ${evidence.length} grounded legal evidence item(s).`
            : "No sufficient grounded legal evidence was retrieved.";
          const output: ResearchAgentOutput = {
            summary,
            answer: summary,
            authorities: buildAuthorities(evidence),
            web_sources: buildWebSources(evidence),
            open_questions: evidence.length
              ? []
              : ["No grounded legal evidence was retrieved for this question."],
            confidence: confidenceFromEvidence(evidence.length),
            evidence_ids: evidence.map((item) => item.chunkId),
            citation_ids: [],
          };
          return {
            agentType: "RESEARCH",
            summary: output.summary,
            output: output as unknown as Record<string, unknown>,
            evidenceIds: output.evidence_ids,
            citationIds: output.citation_ids,
            openQuestions: output.open_questions,
            requiresApproval: false,
            statusSummary: incomplete
              ? "Research incomplete due to limits or tool failures"
              : `Found ${output.authorities.length} legal provision(s)`,
            incomplete,
          };
        },
      });

      let candidateEvidence = researchEvidence(context.retrievedEvidence);
      let validation = validateEvidenceAgainstTarget(candidateEvidence, target);

      if (validation.missingTargetProvision) {
        await recordStep({
          context,
          runtime,
          agentType: "RESEARCH",
          action: "research.retry_retrieval",
          outputMetadata: {
            summary: `Rejected ${validation.rejected.length} unrelated provision(s); retrying targeted retrieval`,
            rejected: validation.rejected.map((item) => ({
              provisionNumber: item.provisionNumber,
              title: item.title,
            })),
            decisions: validation.decisions.map((item) => ({
              accepted: item.accepted,
              reason: item.reason,
              diagnostics: item.diagnostics,
            })),
          },
        });
        const retried = await retryTargetedRetrieval(target);
        if (retried.length) {
          candidateEvidence = [...retried, ...candidateEvidence];
          validation = validateEvidenceAgainstTarget(candidateEvidence, target);
        }
      }

      const acceptedArticles = [
        ...new Set(
          validation.accepted
            .map((item) => item.provisionNumber)
            .filter((item): item is string => Boolean(item?.trim())),
        ),
      ];
      const validateSummary = validation.accepted.length
        ? acceptedArticles.length === 1
          ? `Validated evidence · Article ${acceptedArticles[0]} matches research target`
          : acceptedArticles.length > 1
            ? `Validated evidence · Articles ${acceptedArticles.join(", ")} match research target`
            : `Validated evidence · ${validation.accepted.length} relevant provision(s)`
        : "Validated evidence · no provisions matched the research target";

      await recordStep({
        context,
        runtime,
        agentType: "RESEARCH",
        action: "research.validate_evidence",
        outputMetadata: {
          summary: validateSummary,
          acceptedCount: validation.accepted.length,
          rejectedCount: validation.rejected.length,
          decisions: validation.decisions.map((item) => ({
            accepted: item.accepted,
            reason: item.reason,
            diagnostics: item.diagnostics,
          })),
        },
      });

      if (validation.accepted.length) {
        const retrievedLabels = validation.accepted
          .slice(0, 3)
          .map((item) =>
            item.provisionNumber
              ? `Article ${item.provisionNumber}`
              : item.title,
          );
        await recordStep({
          context,
          runtime,
          agentType: "RESEARCH",
          action: "research.retrieved_target",
          outputMetadata: {
            summary: `Retrieved ${retrievedLabels.join(", ")}`,
          },
        });
      }

      const answerQuery = target.resolvedRequest || target.legalIssue || task;
      const evidence = orderEvidenceForAnswer(
        answerQuery,
        validation.accepted,
      );

      const answered =
        evidence.length === 0
          ? {
              answer:
                "The requested legal provision was not retrieved from the indexed corpus. Evidence is insufficient to answer from the research target.",
              citations: [] as LegalCitation[],
              evidenceSufficient: false,
              limitation:
                "No evidence matched the resolved research target after validation.",
            }
          : await answerFromRetrievedEvidence(
              answerQuery,
              evidence,
              null,
              { answerMode: target.answerMode },
            );

      const citations = answered.citations;
      context.citations = mergeCitations(context.citations, citations);
      context.retrievedEvidence = [
        ...evidence,
        ...context.retrievedEvidence.filter(
          (item) => !evidence.some((ordered) => ordered.chunkId === item.chunkId),
        ),
      ];

      const output: ResearchAgentOutput = {
        summary: answered.answer,
        answer: answered.answer,
        authorities: buildAuthorities(evidence),
        web_sources: buildWebSources(evidence),
        open_questions: answered.evidenceSufficient
          ? []
          : [
              answered.limitation ??
                "No grounded legal evidence was retrieved for this question.",
            ],
        confidence: confidenceFromEvidence(evidence.length),
        evidence_ids: evidence.map((item) => item.chunkId),
        citation_ids: citations.map((citation) => citation.marker),
        limitation: answered.limitation,
      };

      const incomplete =
        loopResult.incomplete === true && !answered.evidenceSufficient;

      return {
        ...loopResult,
        incomplete,
        summary: output.answer,
        output: {
          ...(output as unknown as Record<string, unknown>),
          researchTarget: target,
          validatedEvidenceCount: evidence.length,
          rejectedEvidenceCount: validation.rejected.length,
        },
        evidenceIds: output.evidence_ids,
        citationIds: output.citation_ids,
        openQuestions: output.open_questions,
        statusSummary: incomplete
          ? "Research incomplete due to limits or tool failures"
          : answered.evidenceSufficient
            ? `Answered with ${output.authorities.length} relevant provision(s)`
            : "No sufficient grounded legal evidence was retrieved",
      };
    },
  };
}
