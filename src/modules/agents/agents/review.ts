import type { AgentRuntime, LegalAgent } from "@/modules/agents/agents/base";
import { runAgentControlLoop } from "@/modules/agents/agents/control-loop";
import {
  REVIEW_AGENT_INSTRUCTIONS,
  SHARED_AGENT_SYSTEM,
} from "@/modules/agents/prompts";
import type {
  AgentDefinition,
  AgentResult,
  DraftingAgentOutput,
  ReviewAgentOutput,
  ReviewFinding,
} from "@/modules/agents/types";

const DEFINITION: AgentDefinition = {
  id: "REVIEW",
  name: "Review Agent",
  description: "Flags unsupported claims, citation gaps, and contradictions.",
  capabilities: [
    "dynamic_tool_calling",
    "detect_unsupported_claims",
    "validate_citations",
    "review_generated_drafts",
  ],
  systemInstructions: `${SHARED_AGENT_SYSTEM}\n\n${REVIEW_AGENT_INSTRUCTIONS}`,
  allowedTools: [
    "validate_citations",
    "build_legal_context",
    "record_review_findings",
    "retrieve_document",
    "retrieve_memory",
  ],
};

function getDraft(context: {
  priorResults: Record<string, unknown>;
}): DraftingAgentOutput | undefined {
  return (
    (context.priorResults.DRAFTING as DraftingAgentOutput | undefined) ??
    (context.priorResults.DRAFT as DraftingAgentOutput | undefined) ??
    (context.priorResults.__DRAFT_CANDIDATE as DraftingAgentOutput | undefined)
  );
}

function buildHeuristicFindings(input: {
  task: string;
  draft?: DraftingAgentOutput;
  evidenceCount: number;
  knownMarkers: Set<string>;
}): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const text = input.draft?.full_text ?? input.task;

  if (!input.evidenceCount && /law|article|قانون|مادة/i.test(text)) {
    findings.push({
      severity: "HIGH",
      type: "MISSING_EVIDENCE",
      location: "analysis",
      description:
        "Work product references legal standards but little/no grounded evidence is available.",
      evidence: [],
      recommended_action: "Retrieve legal corpus evidence before relying on this output.",
    });
  }

  for (const citationId of input.draft?.citation_ids ?? []) {
    if (!input.knownMarkers.has(citationId)) {
      findings.push({
        severity: "HIGH",
        type: "MISSING_CITATION",
        location: citationId,
        description: `Citation marker ${citationId} is not present in retrieved evidence.`,
        evidence: [],
        recommended_action: "Drop the citation or retrieve supporting evidence.",
      });
    }
  }

  if (/according to article\s+\d+/i.test(text) && input.evidenceCount === 0) {
    findings.push({
      severity: "CRITICAL",
      type: "HALLUCINATED_AUTHORITY",
      location: "draft_or_analysis",
      description: "Possible unsupported authority reference without retrieved evidence.",
      evidence: [],
      recommended_action: "Remove or replace with a retrieved citation.",
    });
  }

  if (!findings.length) {
    findings.push({
      severity: "LOW",
      type: "POTENTIAL_ISSUE",
      location: "overall",
      description:
        "No high-priority grounding issues were automatically detected. Lawyer judgment is still required.",
      evidence: [],
      recommended_action: "Perform a final human review.",
    });
  }
  return findings;
}

export function createReviewAgent(runtime: AgentRuntime): LegalAgent {
  return {
    definition: DEFINITION,
    async execute(context, task): Promise<AgentResult> {
      const draft = getDraft(context);
      const heuristic = buildHeuristicFindings({
        task,
        draft,
        evidenceCount: context.retrievedEvidence.length,
        knownMarkers: new Set(context.citations.map((citation) => citation.marker)),
      });
      context.priorResults.__REVIEW_CANDIDATE = {
        findings: heuristic,
        summary: `Review identified ${heuristic.length} issue(s).`,
        unsupported_claim_count: heuristic.filter(
          (finding) =>
            finding.type === "UNSUPPORTED_CLAIM" ||
            finding.type === "HALLUCINATED_AUTHORITY",
        ).length,
        citation_issues: heuristic.filter(
          (finding) => finding.type === "MISSING_CITATION",
        ).length,
      } satisfies ReviewAgentOutput;

      return runAgentControlLoop({
        context,
        runtime,
        agent: DEFINITION,
        task,
        buildFinalResult: ({ lastOutput, incomplete, context: ctx }) => {
          const output: ReviewAgentOutput =
            lastOutput && Array.isArray(lastOutput.findings)
              ? (lastOutput as unknown as ReviewAgentOutput)
              : (ctx.priorResults.__REVIEW_CANDIDATE as ReviewAgentOutput);

          return {
            agentType: "REVIEW",
            summary: output.summary,
            output: output as unknown as Record<string, unknown>,
            evidenceIds: ctx.retrievedEvidence.map((item) => item.chunkId),
            citationIds: ctx.citations.map((citation) => citation.marker),
            openQuestions: output.findings
              .filter(
                (finding) =>
                  finding.severity === "HIGH" || finding.severity === "CRITICAL",
              )
              .map((finding) => finding.description),
            requiresApproval: false,
            statusSummary: incomplete
              ? "Review incomplete"
              : `Identified ${output.findings.length} issue(s)`,
            incomplete,
          };
        },
      });
    },
  };
}
