import type { AgentRuntime, LegalAgent } from "@/modules/agents/agents/base";
import { runAgentControlLoop } from "@/modules/agents/agents/control-loop";
import { getAgentModelGateway } from "@/modules/agents/model-gateway";
import { getEnv } from "@/lib/env";
import { resolveActiveLlmProvider } from "@/modules/llm/request-selection";
import {
  DRAFTING_AGENT_INSTRUCTIONS,
  SHARED_AGENT_SYSTEM,
  arabicDefaultDraftTitle,
  isArabicOutputLanguage,
  looksLatinOnly,
  outputLanguageInstruction,
} from "@/modules/agents/prompts";
import type {
  AgentDefinition,
  AgentResult,
  DraftingAgentOutput,
  DocumentAgentOutput,
  ResearchAgentOutput,
  ReviewAgentOutput,
} from "@/modules/agents/types";

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

function isArabicLanguage(language?: string | null) {
  return isArabicOutputLanguage(language);
}

function buildFallbackDraft(
  contextTask: string,
  research: ResearchAgentOutput | null,
  documents: DocumentAgentOutput | null,
  review: ReviewAgentOutput | null,
  memoryFacts: Array<{ key: string; value: string; sourceType: string }> = [],
  draftingStyle?: string,
  language?: string | null,
): DraftingAgentOutput {
  const arabic = isArabicLanguage(language) || /[\u0600-\u06FF]/.test(contextTask);
  const sourceFacts =
    documents?.documents.flatMap((doc) =>
      doc.clauses.slice(0, 3).map((clause) =>
        arabic
          ? `من ${doc.filename}: ${clause}`
          : `From ${doc.filename}: ${clause}`,
      ),
    ) ?? [];
  const authorities =
    research?.authorities.slice(0, 5).map(
      (authority) =>
        `${authority.title}${authority.article ? (arabic ? ` (المادة ${authority.article})` : ` (Art. ${authority.article})`) : ""}: ${authority.evidence.slice(0, 240)}`,
    ) ?? [];
  const findings =
    review?.findings
      .slice(0, 5)
      .map((finding) => `[${finding.severity}] ${finding.type}: ${finding.description}`) ??
    [];
  const clientFact = memoryFacts.find(
    (item) => item.key === "client" || item.key === "اسم_الموظف" || item.key === "employee_name",
  );
  const memoryLines = memoryFacts
    .slice(0, 8)
    .map((item) => `${item.key}: ${item.value} (${item.sourceType})`);

  if (!sourceFacts.length) {
    sourceFacts.push(
      arabic
        ? "وقائع مستندات القضية محدودة؛ تعتمد المسودة فقط على المقتطفات المسترجعة المتاحة."
        : "Matter document facts were limited; draft relies only on available retrieved excerpts.",
    );
  }
  if (!authorities.length) {
    authorities.push(
      arabic
        ? "لم يتم استرجاع سند قانوني موثّق. لا تختلق استشهادات تشريعية."
        : "No grounded legal authority was retrieved. Do not invent statutory citations.",
    );
  }

  const inference = findings.length
    ? arabic
      ? `بناءً على الأدلة المسترجعة، قد تستدعي المسائل التالية مراجعة المحامي:\n${findings.join("\n")}`
      : `Based on retrieved evidence, the following issues may warrant lawyer review:\n${findings.join("\n")}`
    : arabic
      ? "بناءً على الأدلة المتاحة، ينبغي مراجعة المسائل المحتملة من المحامي المسؤول."
      : "Based on available evidence, potential issues should be reviewed by the responsible lawyer.";

  const styleNote = draftingStyle
    ? arabic
      ? `تفضيل الأسلوب: ${draftingStyle}.`
      : `Style preference: ${draftingStyle}.`
    : "";
  const fullText = arabic
    ? [
        "السادة الأفاضل،",
        "",
        clientFact
          ? `بالنيابة عن ${clientFact.value} (من سياق الذاكرة، وليس سندًا قانونيًا):`
          : "بالنيابة عن موكلنا:",
        "",
        "سياق الذاكرة (ليس سندًا قانونيًا):",
        ...(memoryLines.length ? memoryLines.map((item) => `- ${item}`) : ["- (لا يوجد)"]),
        "",
        "وقائع المصدر (مستندات القضية):",
        ...sourceFacts.map((item) => `- ${item}`),
        "",
        "السند القانوني (الأدلة المسترجعة فقط):",
        ...authorities.map((item) => `- ${item}`),
        "",
        "الاستنتاج (ليس واقعة ثابتة):",
        inference,
        "",
        "نص المسودة:",
        "يرجى مراجعة المسائل أعلاه مع المحامي. لا تُرسل هذه المسودة أو تُستخدم خارجيًا قبل الموافقة.",
        styleNote,
        "",
        `المهمة: ${contextTask.slice(0, 240)}`,
      ].join("\n")
    : [
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
    title: arabic ? "إنذار بشأن إنهاء الخدمة" : "Employment issues letter",
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
      arabic
        ? "يجب موافقة المحامي قبل أي تواصل خارجي."
        : "Lawyer must approve before any external communication.",
      ...(authorities[0]?.includes("No grounded") ||
      authorities[0]?.includes("لم يتم استرجاع")
        ? [
            arabic
              ? "غير مدعوم / يحتاج مراجعة: نقص السند القانوني"
              : "UNSUPPORTED / NEEDS REVIEW: missing legal authority",
          ]
        : []),
    ],
  };
}

async function maybeGenerateWithGateway(input: {
  task: string;
  fallback: DraftingAgentOutput;
  evidenceText: string;
  priorText: string;
  language?: string | null;
}): Promise<DraftingAgentOutput> {
  if (resolveActiveLlmProvider(getEnv().LLM_PROVIDER) === "mock") {
    return input.fallback;
  }

  const gateway = getAgentModelGateway();
  const languageRule = outputLanguageInstruction(input.language);
  const structured = await gateway.structuredOutput({
    system: `${DEFINITION.systemInstructions}\n\n${languageRule}`,
    instructions:
      "Produce a grounded draft JSON. Never invent authorities. Distinguish SOURCE_FACT, LEGAL_AUTHORITY, INFERENCE, DRAFT_LANGUAGE. If evidence is insufficient, mark open_questions with UNSUPPORTED / NEEDS REVIEW. Follow OUTPUT LANGUAGE rules for title and full_text.",
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

  const rawTitle =
    typeof structured.title === "string" ? structured.title : input.fallback.title;
  const title =
    isArabicOutputLanguage(input.language) && looksLatinOnly(rawTitle)
      ? arabicDefaultDraftTitle()
      : rawTitle;

  return {
    ...input.fallback,
    ...structured,
    title,
    draft_type:
      typeof structured.draft_type === "string"
        ? structured.draft_type
        : input.fallback.draft_type,
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
        context.memory.resolvedInstructions.language,
      );
      const draft = await maybeGenerateWithGateway({
        task,
        fallback,
        language: context.memory.resolvedInstructions.language,
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
          const arabic = isArabicLanguage(
            context.memory.resolvedInstructions.language,
          );
          let output =
            lastOutput && typeof lastOutput.full_text === "string"
              ? ({ ...draft, ...lastOutput } as DraftingAgentOutput)
              : lastOutput && typeof lastOutput.fullText === "string"
                ? ({
                    ...draft,
                    full_text: String(lastOutput.fullText),
                    title: String(lastOutput.title ?? draft.title),
                  } as DraftingAgentOutput)
                : draft;

          if (
            arabic &&
            typeof output.title === "string" &&
            looksLatinOnly(output.title)
          ) {
            output = { ...output, title: arabicDefaultDraftTitle() };
          }

          return {
            agentType: "DRAFTING",
            summary: arabic
              ? `تم إنشاء المسودة: «${output.title}»`
              : `Created draft: ${output.title}`,
            output: output as unknown as Record<string, unknown>,
            evidenceIds: output.evidence_ids ?? [],
            citationIds: output.citation_ids ?? [],
            openQuestions: output.open_questions ?? [],
            requiresApproval: true,
            approvalAction: "create_draft",
            statusSummary: incomplete
              ? arabic
                ? "الصياغة غير مكتملة"
                : "Drafting incomplete"
              : requiresApproval || true
                ? arabic
                  ? "بانتظار الموافقة"
                  : "Waiting for approval"
                : arabic
                  ? "اكتملت المسودة"
                  : "Draft complete",
            incomplete,
          };
        },
      });
    },
  };
}
