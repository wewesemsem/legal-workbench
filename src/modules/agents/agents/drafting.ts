import type { AgentRuntime, LegalAgent } from "@/modules/agents/agents/base";
import { runAgentControlLoop } from "@/modules/agents/agents/control-loop";
import { getAgentModelGateway } from "@/modules/agents/model-gateway";
import {
  DRAFTING_AGENT_INSTRUCTIONS,
  SHARED_AGENT_SYSTEM,
} from "@/modules/agents/prompts";
import type {
  AgentDefinition,
  AgentResult,
  DraftingAgentOutput,
  DocumentAgentOutput,
  ResearchAgentOutput,
  ReviewAgentOutput,
} from "@/modules/agents/types";
import { getEnv } from "@/lib/env";

const DEFINITION: AgentDefinition = {
  id: "DRAFTING",
  name: "Drafting Agent",
  description: "Creates grounded legal drafts via Model Gateway; requires approval.",
  capabilities: [
    "model_gateway_drafting",
    "preserve_citations",
    "distinguish_fact_authority_inference",
    "human_approval_required",
  ],
  systemInstructions: `${SHARED_AGENT_SYSTEM}\n\n${DRAFTING_AGENT_INSTRUCTIONS}`,
  allowedTools: [
    "build_legal_context",
    "validate_citations",
    "create_draft",
    "request_approval",
    "retrieve_memory",
  ],
};

function buildFallbackDraft(
  contextTask: string,
  research: ResearchAgentOutput | null,
  documents: DocumentAgentOutput | null,
  review: ReviewAgentOutput | null,
  memoryFacts: Array<{ key: string; value: string; sourceType: string }> = [],
  draftingStyle?: string,
): DraftingAgentOutput {
  const sourceFacts =
    documents?.documents.flatMap((doc) =>
      doc.clauses.slice(0, 3).map((clause) => `From ${doc.filename}: ${clause}`),
    ) ?? [];
  const authorities =
    research?.authorities.slice(0, 5).map(
      (authority) =>
        `${authority.title}${authority.article ? ` (Art. ${authority.article})` : ""}: ${authority.evidence.slice(0, 240)}`,
    ) ?? [];
  const findings =
    review?.findings
      .slice(0, 5)
      .map((finding) => `[${finding.severity}] ${finding.type}: ${finding.description}`) ??
    [];
  const clientFact = memoryFacts.find((item) => item.key === "client");
  const memoryLines = memoryFacts
    .slice(0, 8)
    .map((item) => `${item.key}: ${item.value} (${item.sourceType})`);

  if (!sourceFacts.length) {
    sourceFacts.push(
      "Matter document facts were limited; draft relies only on available retrieved excerpts.",
    );
  }
  if (!authorities.length) {
    authorities.push(
      "No grounded legal authority was retrieved. Do not invent statutory citations.",
    );
  }

  const inference = findings.length
    ? `Based on retrieved evidence, the following issues may warrant lawyer review:\n${findings.join("\n")}`
    : "Based on available evidence, potential issues should be reviewed by the responsible lawyer.";

  const styleNote = draftingStyle ? `Style preference: ${draftingStyle}.` : "";
  const fullText = [
    "Dear Sir/Madam,",
    "",
    clientFact
      ? `On behalf of ${clientFact.value} (from MEMORY CONTEXT, not legal authority):`
      : "On behalf of our client:",
    "",
    "MEMORY CONTEXT (not legal authority):",
    ...(memoryLines.length ? memoryLines.map((item) => `- ${item}`) : ["- (none)"]),
    "",
    "SOURCE FACT (matter documents):",
    ...sourceFacts.map((item) => `- ${item}`),
    "",
    "LEGAL AUTHORITY (retrieved evidence only):",
    ...authorities.map((item) => `- ${item}`),
    "",
    "INFERENCE (not established fact):",
    inference,
    "",
    "DRAFT LANGUAGE:",
    "Please review the issues above with counsel. This draft is not filed or sent until approved.",
    styleNote,
    "",
    `Task: ${contextTask.slice(0, 240)}`,
  ].join("\n");

  return {
    title: "Employment issues letter",
    draft_type: "DEMAND_OR_EXPLANATORY_LETTER",
    sections: [
      { kind: "SOURCE_FACT", content: sourceFacts.join("\n") },
      {
        kind: "LEGAL_AUTHORITY",
        content: authorities.join("\n"),
        citation_ids: research?.citation_ids ?? [],
      },
      { kind: "INFERENCE", content: inference },
      { kind: "DRAFT_LANGUAGE", content: fullText },
    ],
    full_text: fullText,
    citation_ids: research?.citation_ids ?? [],
    evidence_ids: [
      ...(research?.evidence_ids ?? []),
      ...(documents?.evidence_ids ?? []),
    ],
    open_questions: [
      ...(research?.open_questions ?? []),
      "Lawyer must approve before any external communication.",
      ...(authorities[0]?.includes("No grounded")
        ? ["UNSUPPORTED / NEEDS REVIEW: missing legal authority"]
        : []),
    ],
  };
}

async function maybeGenerateWithGateway(input: {
  task: string;
  fallback: DraftingAgentOutput;
  evidenceText: string;
  priorText: string;
}): Promise<DraftingAgentOutput> {
  if (getEnv().LLM_PROVIDER === "mock") {
    return input.fallback;
  }

  const gateway = getAgentModelGateway();
  const structured = await gateway.structuredOutput({
    system: DEFINITION.systemInstructions,
    instructions:
      "Produce a grounded draft JSON. Never invent authorities. Distinguish SOURCE_FACT, LEGAL_AUTHORITY, INFERENCE, DRAFT_LANGUAGE. If evidence is insufficient, mark open_questions with UNSUPPORTED / NEEDS REVIEW.",
    task: input.task,
    matterContext: "Matter-scoped drafting only.",
    evidence: input.evidenceText,
    toolResults: input.priorText,
    schemaHint: JSON.stringify({
      title: "string",
      draft_type: "string",
      sections: [
        {
          kind: "SOURCE_FACT|LEGAL_AUTHORITY|INFERENCE|DRAFT_LANGUAGE",
          content: "string",
          evidence_ids: [],
          citation_ids: [],
        },
      ],
      full_text: "string",
      citation_ids: [],
      evidence_ids: [],
      open_questions: [],
    }),
  });

  if (!structured || typeof structured.full_text !== "string") {
    return input.fallback;
  }

  return {
    ...input.fallback,
    ...structured,
    title:
      typeof structured.title === "string"
        ? structured.title
        : input.fallback.title,
    full_text: String(structured.full_text),
    sections: Array.isArray(structured.sections)
      ? (structured.sections as DraftingAgentOutput["sections"])
      : input.fallback.sections,
    citation_ids: Array.isArray(structured.citation_ids)
      ? (structured.citation_ids as string[])
      : input.fallback.citation_ids,
    evidence_ids: Array.isArray(structured.evidence_ids)
      ? (structured.evidence_ids as string[])
      : input.fallback.evidence_ids,
    open_questions: Array.isArray(structured.open_questions)
      ? (structured.open_questions as string[])
      : input.fallback.open_questions,
  };
}

export function createDraftingAgent(runtime: AgentRuntime): LegalAgent {
  return {
    definition: DEFINITION,
    async execute(context, task): Promise<AgentResult> {
      if (!context.permissions.canRunDrafting) {
        throw new Error("Drafting is restricted to lawyer roles");
      }

      const research = (context.priorResults.RESEARCH ??
        null) as ResearchAgentOutput | null;
      const documents = (context.priorResults.DOCUMENT ??
        null) as DocumentAgentOutput | null;
      const review = (context.priorResults.REVIEW ??
        null) as ReviewAgentOutput | null;
      const fallback = buildFallbackDraft(
        task,
        research,
        documents,
        review,
        context.memory.matterFacts,
        context.memory.resolvedInstructions.draftingStyle,
      );
      const draft = await maybeGenerateWithGateway({
        task,
        fallback,
        evidenceText: [
          context.memory.formatted,
          "",
          context.retrievedEvidence
            .slice(0, 12)
            .map(
              (item) =>
                `[${item.sourceKind}] ${item.title}: ${item.text.slice(0, 300)}`,
            )
            .join("\n"),
        ].join("\n"),
        priorText: JSON.stringify({
          researchSummary: research?.summary,
          documentSummary: documents?.summary,
          reviewSummary: review?.summary,
          memoryFacts: context.memory.matterFacts,
        }),
      });

      // Seed prior result so mock tool create_draft / finalize can reuse it.
      context.priorResults.__DRAFT_CANDIDATE = draft;

      return runAgentControlLoop({
        context,
        runtime,
        agent: DEFINITION,
        task,
        buildFinalResult: ({ lastOutput, incomplete, requiresApproval }) => {
          const output =
            lastOutput && typeof lastOutput.full_text === "string"
              ? ({ ...draft, ...lastOutput } as DraftingAgentOutput)
              : lastOutput && typeof lastOutput.fullText === "string"
                ? ({
                    ...draft,
                    full_text: String(lastOutput.fullText),
                    title: String(lastOutput.title ?? draft.title),
                  } as DraftingAgentOutput)
                : draft;

          return {
            agentType: "DRAFTING",
            summary: `Created draft: ${output.title}`,
            output: output as unknown as Record<string, unknown>,
            evidenceIds: output.evidence_ids ?? [],
            citationIds: output.citation_ids ?? [],
            openQuestions: output.open_questions ?? [],
            requiresApproval: true,
            approvalAction: "create_draft",
            statusSummary: incomplete
              ? "Drafting incomplete"
              : requiresApproval || true
                ? "Waiting for approval"
                : "Draft complete",
            incomplete,
          };
        },
      });
    },
  };
}
