import { z } from "zod";

import { forbidden } from "@/modules/authorization/errors";
import {
  getMatterDocument,
  listDocumentPages,
  listMatterDocuments,
} from "@/modules/documents/service";
import {
  arabicDefaultDraftTitle,
  isArabicOutputLanguage,
  looksLatinOnly,
} from "@/modules/agents/prompts";
import type { AgentContext } from "@/modules/agents/types";
import { buildLegalContext } from "@/modules/legal-retrieval/context-builder";
import { runLegalResearch } from "@/modules/legal-retrieval/research";
import {
  corpusQueryFromIntent,
  searchArgsFromIntent,
} from "@/modules/legal-retrieval/resolve-intent";
import { searchLegalCorpus } from "@/modules/legal-retrieval/service";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";
import type { AgentToolDefinition } from "@/modules/agents/tools/types";

function truncate(text: string, max = 1_200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}

function assertMatterBound(documentMatterId: string, expectedMatterId: string) {
  if (documentMatterId !== expectedMatterId) {
    throw forbidden("Document is outside the authorized matter");
  }
}

/** Merge tool evidence; keep the higher-scoring copy of each chunk. */
function absorbEvidence(context: { agentContext: AgentContext }, items: LegalEvidence[]) {
  for (const item of items) {
    const index = context.agentContext.retrievedEvidence.findIndex(
      (existing) => existing.chunkId === item.chunkId,
    );
    if (index < 0) {
      context.agentContext.retrievedEvidence.push(item);
      continue;
    }
    if (item.score > context.agentContext.retrievedEvidence[index]!.score) {
      context.agentContext.retrievedEvidence[index] = item;
    }
  }
}

export const searchLegalCorpusTool: AgentToolDefinition = {
  name: "search_legal_corpus",
  description: "Search the Egyptian legal corpus for relevant provisions.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      query: z.string().trim().min(1).max(4_000),
      limit: z.number().int().positive().max(20).optional(),
    })
    .strict(),
  async execute(input, context) {
    const intent = context.agentContext.retrievalIntent;
    const query = corpusQueryFromIntent({
      toolQuery: input.query,
      userTask: context.agentContext.task,
      intent,
    });
    const result = await searchLegalCorpus(
      intent
        ? {
            ...searchArgsFromIntent(intent, { limit: input.limit }),
            query,
          }
        : { query, limit: input.limit },
    );
    absorbEvidence(context, result.evidence);
    return {
      evidenceCount: result.evidence.length,
      evidence: result.evidence.slice(0, 10).map((item) => ({
        chunkId: item.chunkId,
        title: item.title,
        provisionNumber: item.provisionNumber,
        sourceUrl: item.sourceUrl,
        authorityStatus: item.authorityStatus,
        score: item.score,
        text: truncate(item.text, 800),
      })),
      limitation: result.limitation?.message ?? null,
      retrievalQuery: query,
      intentSource: intent?.source ?? null,
    };
  },
};

export const searchWebTool: AgentToolDefinition = {
  name: "search_web",
  description: "Search the public internet for official legal sources.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      query: z.string().trim().min(1).max(4_000),
    })
    .strict(),
  async execute(input, context) {
    const result = await runLegalResearch({
      query: input.query,
      sourceMode: "WEB",
      matterId: context.agentContext.matterId,
      auth: context.agentContext.user,
    });
    absorbEvidence(context, result.evidence);
    context.agentContext.citations = [
      ...context.agentContext.citations,
      ...result.citations.filter(
        (citation) =>
          !context.agentContext.citations.some(
            (existing) => existing.marker === citation.marker,
          ),
      ),
    ];
    return {
      evidenceCount: result.evidence.length,
      researchSources: result.researchSources.slice(0, 8),
      evidence: result.evidence.slice(0, 8).map((item) => ({
        chunkId: item.chunkId,
        title: item.title,
        sourceUrl: item.sourceUrl,
        webAuthority: item.webAuthority,
        text: truncate(item.text, 800),
        score: item.score,
      })),
      limitation: result.limitation,
      researchRunId: result.researchRunId,
    };
  },
};

export const retrieveLegalProvisionTool: AgentToolDefinition = {
  name: "retrieve_legal_provision",
  description: "Retrieve grounded corpus evidence for a legal query.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      query: z.string().trim().min(1).max(4_000),
    })
    .strict(),
  async execute(input, context) {
    const intent = context.agentContext.retrievalIntent;
    const query = corpusQueryFromIntent({
      toolQuery: input.query,
      userTask: context.agentContext.task,
      intent,
    });
    const result = await searchLegalCorpus(
      intent
        ? { ...searchArgsFromIntent(intent, { limit: 5 }), query }
        : { query, limit: 5 },
    );
    absorbEvidence(context, result.evidence);
    return {
      evidence: result.evidence.map((item) => ({
        chunkId: item.chunkId,
        documentId: item.documentId,
        provisionId: item.provisionId,
        title: item.title,
        provisionNumber: item.provisionNumber,
        hierarchyPath: item.hierarchyPath,
        sourceUrl: item.sourceUrl,
        text: truncate(item.text, 1_500),
      })),
      limitation: result.limitation?.message ?? null,
    };
  },
};

export const retrieveWebSourceTool: AgentToolDefinition = {
  name: "retrieve_web_source",
  description: "Run corpus+web research and return web provenance records.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      query: z.string().trim().min(1).max(4_000),
      sourceMode: z.enum(["CORPUS", "WEB", "BOTH"]).default("BOTH"),
    })
    .strict(),
  async execute(input, context) {
    const result = await runLegalResearch({
      query: input.query,
      sourceMode: input.sourceMode,
      matterId: context.agentContext.matterId,
      auth: context.agentContext.user,
    });
    absorbEvidence(context, result.evidence);
    context.agentContext.citations = [
      ...context.agentContext.citations,
      ...result.citations.filter(
        (citation) =>
          !context.agentContext.citations.some(
            (existing) => existing.marker === citation.marker,
          ),
      ),
    ];
    return {
      answer: result.answer,
      citations: result.citations,
      evidence: result.evidence.slice(0, 12).map((item) => ({
        chunkId: item.chunkId,
        sourceKind: item.sourceKind,
        title: item.title,
        provisionNumber: item.provisionNumber,
        sourceUrl: item.sourceUrl,
        authorityStatus: item.authorityStatus,
        webAuthority: item.webAuthority ?? null,
        text: truncate(item.text, 900),
        score: item.score,
        date: item.date,
      })),
      researchSources: result.researchSources,
      evidenceSufficient: result.evidenceSufficient,
      limitation: result.limitation,
      researchRunId: result.researchRunId,
    };
  },
};

export const buildLegalContextTool: AgentToolDefinition = {
  name: "build_legal_context",
  description: "Format retrieved evidence into a grounded legal context block.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      evidenceIds: z.array(z.string().min(1)).max(30).default([]),
    })
    .strict(),
  async execute(input, context) {
    const evidence = context.agentContext.retrievedEvidence.filter((item) =>
      input.evidenceIds.length
        ? input.evidenceIds.includes(item.chunkId)
        : true,
    );
    return {
      context: buildLegalContext(evidence),
      evidenceCount: evidence.length,
    };
  },
};

export const listMatterDocumentsTool: AgentToolDefinition = {
  name: "list_matter_documents",
  description: "List documents in the authorized matter.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER", "CLIENT"],
  enabled: true,
  inputSchema: z.object({}).strict(),
  async execute(_input, context) {
    const docs = await listMatterDocuments({
      matterId: context.agentContext.matterId,
      context: context.agentContext.user,
    });
    return {
      documents: docs.map((doc) => ({
        id: doc.id,
        filename: doc.originalFilename,
        processingStatus: doc.processingStatus,
        pageCount: doc.pageCount,
        mimeType: doc.mimeType,
      })),
    };
  },
};

export const searchMatterDocumentsTool: AgentToolDefinition = {
  name: "search_matter_documents",
  description:
    "Hybrid Matter RAG search over authorized matter documents (keyword + vector). Returns page-level excerpts.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER", "CLIENT"],
  enabled: true,
  inputSchema: z
    .object({
      query: z.string().trim().min(1).max(500),
      limit: z.number().int().positive().max(20).optional(),
      documentId: z.string().trim().min(1).max(80).optional(),
    })
    .strict(),
  async execute(input, context) {
    const { indexMatterDocumentsForMatter } = await import(
      "@/modules/matter-rag/index-document"
    );
    const { searchMatterDocumentsHybrid } = await import(
      "@/modules/matter-rag/search"
    );

    // Ensure processed docs are indexed (idempotent for already-indexed content).
    await indexMatterDocumentsForMatter(context.agentContext.matterId);

    const hits = await searchMatterDocumentsHybrid({
      query: input.query,
      matterId: context.agentContext.matterId,
      workspaceId: context.agentContext.workspaceId,
      auth: context.agentContext.user,
      limit: input.limit ?? 8,
      documentId: input.documentId,
    });

    // Keep evidence on the agent context for later drafting/review.
    const { matterHitsToEvidence } = await import("@/modules/matter-rag/search");
    const evidence = matterHitsToEvidence(hits, context.agentContext.matterId);
    absorbEvidence(context, evidence);

    return {
      mode: "matter_hybrid_rag",
      hits: hits.map((hit) => ({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        filename: hit.filename,
        page: hit.pageNumber,
        pageId: hit.pageId,
        excerpt: truncate(hit.text, 400),
        score: hit.score,
        keywordScore: hit.keywordScore,
        vectorScore: hit.vectorScore,
      })),
      query: input.query,
      evidenceCount: evidence.length,
    };
  },
};

export const retrieveDocumentTool: AgentToolDefinition = {
  name: "retrieve_document",
  description: "Retrieve a matter document and its processed summary metadata.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER", "CLIENT"],
  enabled: true,
  inputSchema: z
    .object({
      documentId: z.string().trim().min(1).max(80),
      includeExtractedText: z.boolean().optional(),
    })
    .strict(),
  async execute(input, context) {
    const detail = await getMatterDocument({
      documentId: input.documentId,
      context: context.agentContext.user,
      includeExtractedText: input.includeExtractedText === true,
    });
    assertMatterBound(detail.document.matterId, context.agentContext.matterId);
    return {
      document: {
        id: detail.document.id,
        matterId: detail.document.matterId,
        filename: detail.document.originalFilename,
        processingStatus: detail.document.processingStatus,
        pageCount: detail.document.pageCount,
        extractedText: detail.document.extractedText
          ? truncate(detail.document.extractedText, 6_000)
          : undefined,
      },
      pageCount: detail.pages.length,
    };
  },
};

export const retrieveDocumentPageTool: AgentToolDefinition = {
  name: "retrieve_document_page",
  description: "Retrieve a specific processed document page.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER", "CLIENT"],
  enabled: true,
  inputSchema: z
    .object({
      documentId: z.string().trim().min(1).max(80),
      pageNumber: z.number().int().positive().max(10_000).optional(),
    })
    .strict(),
  async execute(input, context) {
    const detail = await getMatterDocument({
      documentId: input.documentId,
      context: context.agentContext.user,
    });
    assertMatterBound(detail.document.matterId, context.agentContext.matterId);
    const pages = await listDocumentPages({
      documentId: input.documentId,
      context: context.agentContext.user,
    });
    const selected = input.pageNumber
      ? pages.filter((page) => page.pageNumber === input.pageNumber)
      : pages.slice(0, 5);
    return {
      documentId: input.documentId,
      pages: selected.map((page) => ({
        pageNumber: page.pageNumber,
        text: truncate(page.extractedText ?? "", 2_500),
      })),
    };
  },
};

export const searchDocumentTextTool: AgentToolDefinition = {
  name: "search_document_text",
  description: "Search text within one matter document.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER", "CLIENT"],
  enabled: true,
  inputSchema: z
    .object({
      documentId: z.string().trim().min(1).max(80),
      query: z.string().trim().min(1).max(500),
    })
    .strict(),
  async execute(input, context) {
    const detail = await getMatterDocument({
      documentId: input.documentId,
      context: context.agentContext.user,
      includeExtractedText: true,
    });
    assertMatterBound(detail.document.matterId, context.agentContext.matterId);
    const needle = input.query.toLowerCase();
    const hits = detail.pages
      .filter((page) => (page.extractedText ?? "").toLowerCase().includes(needle))
      .slice(0, 10)
      .map((page) => {
        const text = page.extractedText ?? "";
        const idx = text.toLowerCase().indexOf(needle);
        return {
          page: page.pageNumber,
          excerpt: truncate(text.slice(Math.max(0, idx - 60), idx + 220), 400),
        };
      });
    return { documentId: input.documentId, hits };
  },
};

export const citationTool: AgentToolDefinition = {
  name: "validate_citations",
  description: "Validate that cited markers exist in retrieved evidence.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      citationIds: z.array(z.string().min(1)).max(50),
    })
    .strict(),
  async execute(input, context) {
    const known = new Set(
      context.agentContext.citations.map((citation) => citation.marker),
    );
    const evidenceIds = new Set(
      context.agentContext.retrievedEvidence.map((item) => item.chunkId),
    );
    const missing = (input.citationIds as string[]).filter(
      (id: string) => !known.has(id) && !evidenceIds.has(id),
    );
    return {
      valid: missing.length === 0,
      missing,
      knownCount: known.size,
    };
  },
};

export const draftTool: AgentToolDefinition = {
  name: "create_draft",
  description: "Create a structured grounded draft object (WRITE; needs approval).",
  riskLevel: "WRITE",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      title: z.string().trim().min(1).max(200),
      draftType: z.string().trim().min(1).max(80),
      fullText: z.string().trim().min(1).max(50_000),
      sections: z
        .array(
          z
            .object({
              kind: z.enum([
                "SOURCE_FACT",
                "LEGAL_AUTHORITY",
                "INFERENCE",
                "DRAFT_LANGUAGE",
              ]),
              content: z.string().trim().min(1).max(20_000),
              evidence_ids: z.array(z.string()).optional(),
              citation_ids: z.array(z.string()).optional(),
            })
            .strict(),
        )
        .max(40),
      evidenceIds: z.array(z.string()).max(50).default([]),
      citationIds: z.array(z.string()).max(50).default([]),
    })
    .strict(),
  async execute(input, context) {
    const language =
      context.agentContext.memory.resolvedInstructions.language;
    const title =
      isArabicOutputLanguage(language) && looksLatinOnly(input.title)
        ? arabicDefaultDraftTitle()
        : input.title;
    return {
      title,
      draft_type: input.draftType,
      sections: input.sections,
      full_text: input.fullText,
      evidence_ids: input.evidenceIds,
      citation_ids: input.citationIds,
      open_questions: [],
    };
  },
};

export const reviewTool: AgentToolDefinition = {
  name: "record_review_findings",
  description: "Record structured review findings for a work product.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      findings: z
        .array(
          z
            .object({
              severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
              type: z.enum([
                "UNSUPPORTED_CLAIM",
                "MISSING_CITATION",
                "CONTRADICTION",
                "AMBIGUOUS_LANGUAGE",
                "MISSING_EVIDENCE",
                "POTENTIAL_ISSUE",
                "HALLUCINATED_AUTHORITY",
              ]),
              location: z.string().max(500),
              description: z.string().max(4_000),
              evidence: z.array(z.string()).max(20).default([]),
              recommended_action: z.string().max(2_000),
            })
            .strict(),
        )
        .max(50),
      summary: z.string().max(4_000),
    })
    .strict(),
  async execute(input) {
    const findings = input.findings as Array<{ type: string }>;
    return {
      findings: input.findings,
      summary: input.summary,
      unsupported_claim_count: findings.filter(
        (finding) =>
          finding.type === "UNSUPPORTED_CLAIM" ||
          finding.type === "HALLUCINATED_AUTHORITY",
      ).length,
      citation_issues: findings.filter(
        (finding) => finding.type === "MISSING_CITATION",
      ).length,
    };
  },
};

export const approvalTool: AgentToolDefinition = {
  name: "request_approval",
  description: "Request human approval for a medium/high-risk action.",
  riskLevel: "WRITE",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      action: z.string().trim().min(1).max(120),
      description: z.string().trim().min(1).max(4_000),
      proposedOutput: z.record(z.string(), z.unknown()),
      riskLevel: z.enum(["READ", "WRITE", "EXTERNAL_ACTION"]).default("WRITE"),
    })
    .strict(),
  async execute(input) {
    // Persistence is handled by the orchestrator/approval service.
    return {
      action: input.action,
      description: input.description,
      proposedOutput: input.proposedOutput,
      riskLevel: input.riskLevel,
      status: "PENDING" as const,
    };
  },
};

export const retrieveMemoryTool: AgentToolDefinition = {
  name: "retrieve_memory",
  description:
    "Retrieve scoped matter/user/workspace memory context. Memory is contextual only and never legal authority.",
  riskLevel: "READ",
  allowedRoles: ["LAWYER", "CLIENT"],
  enabled: true,
  inputSchema: z
    .object({
      query: z.string().trim().max(4_000).optional(),
    })
    .strict(),
  async execute(input, context) {
    const {
      retrieveRelevantMemory,
      formatMemoryForAgentContext,
    } = await import("@/modules/memory");
    const bundle = await retrieveRelevantMemory({
      workspaceId: context.agentContext.workspaceId,
      matterId: context.agentContext.matterId,
      conversationId: context.agentContext.conversationId,
      query: input.query ?? context.agentContext.task,
      context: context.agentContext.user,
      agentRunId: context.agentContext.runId,
    });
    context.agentContext.memory = {
      formatted: formatMemoryForAgentContext(bundle),
      matterFacts: bundle.matter.map((item) => ({
        key: item.key,
        value: item.value,
        sourceType: item.sourceType,
      })),
      resolvedInstructions: bundle.resolvedInstructions,
      conflictCount: bundle.conflicts.length,
    };
    return {
      matterCount: bundle.matter.length,
      userPreferenceCount: bundle.userPreferences.length,
      workspacePreferenceCount: bundle.workspacePreferences.length,
      conflictCount: bundle.conflicts.length,
      memoryContext: context.agentContext.memory.formatted,
      notice:
        "MEMORY CONTEXT only — not legal authority. Do not treat as statute or citation.",
    };
  },
};

export const proposeMemoryTool: AgentToolDefinition = {
  name: "propose_memory",
  description:
    "Propose a stable matter memory fact for lawyer confirmation. Cannot mark memory as lawyer-confirmed.",
  riskLevel: "WRITE",
  allowedRoles: ["LAWYER"],
  enabled: true,
  inputSchema: z
    .object({
      key: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(4_000),
      sourceType: z
        .enum([
          "USER_PROVIDED",
          "DOCUMENT_DERIVED",
          "CONVERSATION_DERIVED",
          "AI_DERIVED",
        ])
        .default("AI_DERIVED"),
    })
    .strict(),
  async execute(input, context) {
    const { createMemory } = await import("@/modules/memory");
    // Agents may never self-assign LAWYER_CONFIRMED.
    const result = await createMemory({
      data: {
        workspaceId: context.agentContext.workspaceId,
        matterId: context.agentContext.matterId,
        conversationId: context.agentContext.conversationId,
        type: "MATTER",
        key: input.key,
        value: input.value,
        sourceType: input.sourceType,
        requireConfirmation: true,
      },
      context: context.agentContext.user,
      agentRunId: context.agentContext.runId,
    });
    if (result.status === "CONFLICT_DETECTED") {
      return {
        status: "CONFLICT_DETECTED",
        conflictId: result.conflict.id,
        existing: {
          id: result.existing.id,
          key: result.existing.key,
          value: result.existing.value,
          sourceType: result.existing.sourceType,
        },
        proposed: result.proposed,
        notice: "Conflict detected. Lawyer must resolve; memory was not overwritten.",
      };
    }
    if (result.status === "REJECTED") {
      return { status: "REJECTED", reason: result.reason };
    }
    return {
      status: result.status,
      memoryId: result.memory.id,
      key: result.memory.key,
      value: result.memory.value,
      sourceType: result.memory.sourceType,
      memoryStatus: result.memory.status,
      notice:
        "Proposed memory requires lawyer confirmation before becoming LAWYER_CONFIRMED.",
    };
  },
};

/** Disabled — high-risk external actions require future HITL + implementation. */
export const sendExternalCommunicationTool: AgentToolDefinition = {
  name: "send_external_communication",
  description: "Send email or external communication (NOT_IMPLEMENTED).",
  riskLevel: "EXTERNAL_ACTION",
  allowedRoles: ["LAWYER"],
  enabled: false,
  inputSchema: z
    .object({
      recipient: z.string().email(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(50_000),
    })
    .strict(),
  async execute() {
    return {
      status: "NOT_IMPLEMENTED",
      message:
        "External communications are not implemented. Human approval would be required before any future EXTERNAL_ACTION.",
    };
  },
};

export const ALL_AGENT_TOOLS: AgentToolDefinition[] = [
  searchLegalCorpusTool,
  searchWebTool,
  retrieveLegalProvisionTool,
  retrieveWebSourceTool,
  buildLegalContextTool,
  listMatterDocumentsTool,
  searchMatterDocumentsTool,
  retrieveDocumentTool,
  retrieveDocumentPageTool,
  searchDocumentTextTool,
  citationTool,
  draftTool,
  reviewTool,
  approvalTool,
  retrieveMemoryTool,
  proposeMemoryTool,
  sendExternalCommunicationTool,
];
