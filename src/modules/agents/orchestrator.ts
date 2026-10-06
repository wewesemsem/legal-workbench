import { createAgentRoster } from "@/modules/agents/agents";
import type { AgentRuntime } from "@/modules/agents/agents/base";
import { recordStep } from "@/modules/agents/agents/base";
import { requestHumanApproval } from "@/modules/agents/approval";
import { writeAgentAudit } from "@/modules/agents/audit";
import { defaultAgentLimits } from "@/modules/agents/config";
import {
  assertAgentTypeAllowed,
  buildAgentPermissions,
  toolAllowlistForAgent,
} from "@/modules/agents/permissions";
import { createExecutionPlan } from "@/modules/agents/planner";
import { validateExecutionPlan } from "@/modules/agents/plan-validator";
import {
  createAgentRun,
  updateAgentRun,
  updateAgentStep,
} from "@/modules/agents/repository";
import { getToolRegistry } from "@/modules/agents/tools/registry";
import type {
  AgentContext,
  AgentResult,
  AgentType,
  ExecutionPlan,
} from "@/modules/agents/types";
import { forbidden, validationError } from "@/modules/authorization/errors";
import type { AuthContext } from "@/modules/authorization/permissions";
import { assertMatterAccess } from "@/modules/authorization/permissions";
import { listMatterDocuments } from "@/modules/documents/service";
import {
  getMatterForUser,
  listMatterParticipants,
} from "@/modules/matters/service";
import {
  createMemory,
  extractMemoryProposalFromTask,
  formatMemoryForAgentContext,
  retrieveRelevantMemory,
} from "@/modules/memory";
import {
  resolveConversationContext,
  type ConversationMessage,
} from "@/modules/legal-retrieval/conversation-context";
import { getRequestLocale } from "@/modules/i18n/server";
import {
  isArabicOutputLanguage,
} from "@/modules/agents/prompts";

export type StartAgentRunInput = {
  matterId: string;
  task: string;
  agentType?: AgentType;
  conversationId?: string | null;
  /** Prior turns for conversation/context resolution (not persisted). */
  conversationHistory?: ConversationMessage[];
  context: AuthContext;
};

export type AgentRunView = {
  runId: string;
  status: string;
  task: string;
  plan: ExecutionPlan | Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorSummary: string | null;
  steps: Array<{
    sequence: number;
    agentType: string;
    action: string;
    tool: string | null;
    status: string;
    summary?: string;
    createdAt: Date;
  }>;
  approvalId: string | null;
};

export type PreparedAgentRun = {
  view: AgentRunView;
  execute: () => Promise<AgentRunView>;
};

async function buildContext(input: {
  runId: string;
  matterId: string;
  task: string;
  conversationId?: string | null;
  context: AuthContext;
}): Promise<AgentContext> {
  const matterAccess = await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });
  const matter = await getMatterForUser({
    matterId: input.matterId,
    context: input.context,
  });
  const participants = await listMatterParticipants({
    matterId: input.matterId,
    context: input.context,
  });
  const documents = await listMatterDocuments({
    matterId: input.matterId,
    context: input.context,
  });
  const permissions = buildAgentPermissions({
    context: input.context,
    matterRole: matterAccess.memberRole,
  });

  // Do not pass agentRunId here — the run row may not exist yet.
  const memoryBundle = await retrieveRelevantMemory({
    workspaceId: matterAccess.workspaceId,
    matterId: matterAccess.matterId,
    conversationId: input.conversationId ?? null,
    query: input.task,
    context: input.context,
  });

  let uiLocale = "en";
  try {
    uiLocale = await getRequestLocale();
  } catch {
    uiLocale = "en";
  }
  const resolvedInstructions = {
    ...memoryBundle.resolvedInstructions,
    language:
      memoryBundle.resolvedInstructions.language ||
      (uiLocale === "ar"
        ? "ar"
        : uiLocale === "fr"
          ? "fr"
          : "en"),
  };

  return {
    runId: input.runId,
    user: input.context,
    workspaceId: matterAccess.workspaceId,
    matterId: matterAccess.matterId,
    matterTitle: matter.title,
    participants: participants.map((participant) => ({
      userId: participant.userId,
      role: participant.role,
      firstName: participant.firstName,
      lastName: participant.lastName,
    })),
    conversationId: input.conversationId ?? null,
    relevantDocuments: documents.slice(0, 12).map((doc) => ({
      id: doc.id,
      filename: doc.originalFilename,
      processingStatus: doc.processingStatus,
      pageCount: doc.pageCount,
    })),
    retrievedEvidence: [],
    citations: [],
    memory: {
      formatted: formatMemoryForAgentContext(memoryBundle),
      matterFacts: memoryBundle.matter.map((item) => ({
        key: item.key,
        value: item.value,
        sourceType: item.sourceType,
      })),
      resolvedInstructions,
      conflictCount: memoryBundle.conflicts.length,
    },
    task: input.task,
    permissions,
    toolPermissions: [],
    approvalState: null,
    priorResults: {},
    limits: defaultAgentLimits(),
  };
}

async function maybeProposeMatterMemory(input: {
  agentContext: AgentContext;
  task: string;
  runId: string;
  requestApproval: boolean;
}): Promise<string | null> {
  const proposal = extractMemoryProposalFromTask(input.task);
  if (!proposal) return null;

  const write = await createMemory({
    data: {
      workspaceId: input.agentContext.workspaceId,
      matterId: input.agentContext.matterId,
      conversationId: input.agentContext.conversationId,
      type: "MATTER",
      key: proposal.key,
      value: proposal.value,
      sourceType: "USER_PROVIDED",
      requireConfirmation: true,
      metadata: { proposedFromTask: true },
    },
    context: input.agentContext.user,
    agentRunId: input.runId,
  });

  if (write.status === "CONFLICT_DETECTED") {
    await writeAgentAudit({
      workspaceId: input.agentContext.workspaceId,
      matterId: input.agentContext.matterId,
      agentRunId: input.runId,
      actorUserId: input.agentContext.user.userId,
      action: "memory.conflict_detected",
      metadata: {
        conflictId: write.conflict.id,
        key: write.proposed.key,
        existingValue: write.existing.value,
        proposedValue: write.proposed.value,
      },
    });
    input.agentContext.priorResults.MEMORY_CONFLICT = {
      conflictId: write.conflict.id,
      key: write.proposed.key,
      existingValue: write.existing.value,
      proposedValue: write.proposed.value,
    };
    return null;
  }

  if (write.status === "REJECTED") {
    return null;
  }

  if (write.status !== "PENDING_CONFIRMATION" && write.status !== "CREATED") {
    return null;
  }

  const memory = write.memory;
  input.agentContext.priorResults.MEMORY_PROPOSAL = {
    memoryId: memory.id,
    key: memory.key,
    value: memory.value,
    status: memory.status,
  };

  if (!input.requestApproval) {
    return null;
  }

  return requestHumanApproval({
    workspaceId: input.agentContext.workspaceId,
    matterId: input.agentContext.matterId,
    agentRunId: input.runId,
    action: "save_matter_memory",
    description: `Save to Matter Memory: ${memory.key} = ${memory.value}. Source: User provided. Requires lawyer confirmation.`,
    proposedOutput: {
      memory_id: memory.id,
      key: memory.key,
      value: memory.value,
      source_type: memory.sourceType,
      type: memory.type,
      kind: "MATTER_MEMORY",
    },
    riskLevel: "WRITE",
    actorUserId: input.agentContext.user.userId,
  });
}

export class OrchestratorService {
  async prepareRun(input: StartAgentRunInput): Promise<PreparedAgentRun> {
    const task = input.task.trim();
    if (!task) {
      throw validationError("Task is required");
    }
    if (task.length > 8_000) {
      throw validationError("Task is too long");
    }

    const agentType = input.agentType ?? "ORCHESTRATOR";
    if (
      agentType !== "ORCHESTRATOR" &&
      !["RESEARCH", "DOCUMENT", "DRAFTING", "REVIEW"].includes(agentType)
    ) {
      throw validationError("Unsupported agent_type");
    }

    const runId = crypto.randomUUID();
    const agentContext = await buildContext({
      runId,
      matterId: input.matterId,
      task,
      conversationId: input.conversationId,
      context: input.context,
    });

    assertAgentTypeAllowed(agentContext.permissions, agentType);

    await createAgentRun({
      id: runId,
      workspaceId: agentContext.workspaceId,
      matterId: agentContext.matterId,
      conversationId: agentContext.conversationId,
      initiatedBy: input.context.userId,
      agentType,
      task,
      status: "PLANNING",
    });

    await writeAgentAudit({
      workspaceId: agentContext.workspaceId,
      matterId: agentContext.matterId,
      agentRunId: runId,
      actorUserId: input.context.userId,
      action: "agent_run.started",
      metadata: { agentType, taskChars: task.length },
    });

    const view = await this.toView(runId, null);
    return {
      view,
      execute: async () => {
        try {
          return await this.executeRun({
            runId,
            agentType,
            agentContext,
            task,
            conversationHistory: input.conversationHistory ?? [],
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Agent run failed";
          await updateAgentRun({
            id: runId,
            status: "FAILED",
            errorSummary: message,
            completed: true,
          });
          await writeAgentAudit({
            workspaceId: agentContext.workspaceId,
            matterId: agentContext.matterId,
            agentRunId: runId,
            actorUserId: input.context.userId,
            action: "agent_run.failed",
            metadata: { message },
          });
          throw error;
        }
      },
    };
  }

  async startRun(input: StartAgentRunInput): Promise<AgentRunView> {
    const prepared = await this.prepareRun(input);
    return prepared.execute();
  }

  private async executeRun(input: {
    runId: string;
    agentType: AgentType;
    agentContext: AgentContext;
    task: string;
    conversationHistory: ConversationMessage[];
  }): Promise<AgentRunView> {
    const runtime: AgentRuntime = {
      registry: getToolRegistry(),
      startedAt: Date.now(),
      stepSequence: { current: 0 },
    };

    const conversation = resolveConversationContext({
      message: input.task,
      history: input.conversationHistory,
    });
    input.agentContext.conversationContext = conversation;
    input.agentContext.researchTarget = conversation.target;
    const resolvedTask = conversation.target.resolvedRequest || input.task;

    for (const summary of conversation.processSteps) {
      await recordStep({
        context: input.agentContext,
        runtime,
        agentType: "ORCHESTRATOR",
        action: "conversation.resolve",
        outputMetadata: {
          summary,
          relation: conversation.relation,
          researchTarget: conversation.target,
        },
      });
    }

    const arabicUi = isArabicOutputLanguage(
      input.agentContext.memory.resolvedInstructions.language,
    );

    const planStepId = await recordStep({
      context: input.agentContext,
      runtime,
      agentType: "ORCHESTRATOR",
      action: "orchestrator.plan",
      outputMetadata: {
        summary: arabicUi
          ? "جارٍ إعداد خطة البحث…"
          : "Creating research plan…",
      },
      status: "RUNNING",
    });

    let plan: ExecutionPlan;
    try {
      if (input.agentType === "ORCHESTRATOR") {
        plan = await createExecutionPlan({
          task: resolvedTask,
          permissions: input.agentContext.permissions,
          maxSteps: input.agentContext.limits.maxSteps,
          matterTitle: input.agentContext.matterTitle,
        });
      } else {
        const direct = {
          workflow:
            input.agentType === "RESEARCH"
              ? ("RESEARCH" as const)
              : input.agentType === "DOCUMENT"
                ? ("DOCUMENT_ANALYSIS" as const)
                : input.agentType === "DRAFTING"
                  ? ("DRAFTING" as const)
                  : ("REVIEW" as const),
          goal: resolvedTask,
          steps: [input.agentType],
          detailedSteps: [
            {
              agent: input.agentType,
              task: resolvedTask,
              requiresApproval: input.agentType === "DRAFTING",
            },
          ],
          rationale: `Direct ${input.agentType} invocation`,
          source: "deterministic" as const,
        };
        const validated = validateExecutionPlan({
          proposed: direct,
          permissions: input.agentContext.permissions,
          maxSteps: input.agentContext.limits.maxSteps,
        });
        plan = validated.ok ? validated.plan : direct;
      }

      for (const step of plan.steps) {
        assertAgentTypeAllowed(input.agentContext.permissions, step);
      }

      await updateAgentRun({
        id: input.runId,
        status: "RUNNING",
        plan: plan as unknown as Record<string, unknown>,
      });

      await updateAgentStep({
        id: planStepId,
        outputMetadata: {
          summary: arabicUi
            ? "تم إعداد خطة العمل"
            : `Orchestrator created ${plan.workflow} plan (${plan.source ?? "unknown"})`,
          workflow: plan.workflow,
          steps: plan.steps,
          rationale: plan.rationale,
          source: plan.source ?? "deterministic",
        },
        status: "COMPLETED",
      });
    } catch (error) {
      await updateAgentStep({
        id: planStepId,
        outputMetadata: {
          summary:
            error instanceof Error
              ? error.message
              : arabicUi
                ? "فشل إعداد خطة البحث"
                : "Failed to create research plan",
        },
        status: "FAILED",
      });
      throw error;
    }

    await recordStep({
      context: input.agentContext,
      runtime,
      agentType: "ORCHESTRATOR",
      action: "memory.retrieved",
      outputMetadata: {
        summary: arabicUi
          ? `تم تحميل ${input.agentContext.memory.matterFacts.length} واقعة/وقائع من ذاكرة القضية`
          : `Loaded ${input.agentContext.memory.matterFacts.length} matter memory fact(s)`,
        conflictCount: input.agentContext.memory.conflictCount,
      },
    });

    let approvalId: string | null = await maybeProposeMatterMemory({
      agentContext: input.agentContext,
      task: input.task,
      runId: input.runId,
      requestApproval: plan.workflow === "MEMORY_UPDATE",
    });

    if (approvalId && plan.workflow === "MEMORY_UPDATE") {
      await updateAgentRun({
        id: input.runId,
        status: "WAITING_FOR_APPROVAL",
        plan: plan as unknown as Record<string, unknown>,
        result: {
          workflow: plan.workflow,
          goal: plan.goal,
          memoryProposal: true,
          approvalId,
        },
      });
      return this.toView(input.runId, approvalId);
    }

    if (plan.workflow === "MEMORY_UPDATE" && !approvalId) {
      const conflict = input.agentContext.priorResults.MEMORY_CONFLICT;
      await updateAgentRun({
        id: input.runId,
        status: "COMPLETED",
        plan: plan as unknown as Record<string, unknown>,
        result: {
          workflow: plan.workflow,
          goal: plan.goal,
          memoryProposal: false,
          conflict: conflict ?? null,
          message: conflict
            ? "Memory conflict detected; lawyer resolution required."
            : "No memory proposal was created.",
        },
        completed: true,
      });
      return this.toView(input.runId, null);
    }

    const roster = createAgentRoster(runtime);
    const stepResults: AgentResult[] = [];
    let incomplete = false;
    const detailed = plan.detailedSteps ?? plan.steps.map((agent) => ({
      agent,
      task: resolvedTask,
    }));

    for (const [index, planned] of detailed.entries()) {
      const stepAgent = planned.agent;
      if (runtime.stepSequence.current >= input.agentContext.limits.maxSteps) {
        incomplete = true;
        break;
      }
      if (
        Date.now() - runtime.startedAt >
        input.agentContext.limits.maxExecutionMs
      ) {
        incomplete = true;
        break;
      }

      assertAgentTypeAllowed(input.agentContext.permissions, stepAgent);
      input.agentContext.toolPermissions = toolAllowlistForAgent(stepAgent);

      if (stepAgent === "ORCHESTRATOR") {
        throw forbidden("Orchestrator cannot invoke itself as a worker agent");
      }
      const agent = roster[stepAgent];
      if (!agent) {
        throw forbidden(`Unknown agent type ${stepAgent}`);
      }

      const stepTask = planned.task || resolvedTask;
      const result = await agent.execute(input.agentContext, stepTask);
      stepResults.push(result);
      input.agentContext.priorResults[stepAgent] = result.output;
      if (result.incomplete) incomplete = true;

      if (stepAgent === "REVIEW") {
        const reviews = Array.isArray(input.agentContext.priorResults.REVIEW_HISTORY)
          ? input.agentContext.priorResults.REVIEW_HISTORY
          : [];
        reviews.push(result.output);
        input.agentContext.priorResults.REVIEW_HISTORY = reviews;
        input.agentContext.priorResults.REVIEW = result.output;
      }

      if (result.requiresApproval) {
        const arabic = isArabicOutputLanguage(
          input.agentContext.memory.resolvedInstructions.language,
        );
        const action = result.approvalAction ?? "create_draft";
        approvalId = await requestHumanApproval({
          workspaceId: input.agentContext.workspaceId,
          matterId: input.agentContext.matterId,
          agentRunId: input.runId,
          action,
          description: arabic
            ? `الإجراء: إنشاء مسودة. القضية: ${input.agentContext.matterTitle}. ستُبنى المسودة على السندات القانونية ومستندات القضية المسترجعة.`
            : `Agent: ${agent.definition.name}. Action: ${action}. Matter: ${input.agentContext.matterTitle}. This draft will be based on retrieved legal authorities and matter documents.`,
          proposedOutput: result.output,
          riskLevel: "WRITE",
          actorUserId: input.agentContext.user.userId,
        });

        const remaining = detailed.slice(index + 1);
        const nextIsReviewOnly =
          remaining.length > 0 && remaining.every((item) => item.agent === "REVIEW");
        if (!nextIsReviewOnly) {
          break;
        }
      }
    }

    const research =
      (input.agentContext.priorResults.RESEARCH as Record<string, unknown> | null) ??
      null;
    const review =
      (input.agentContext.priorResults.REVIEW as Record<string, unknown> | null) ??
      null;
    const researchAnswer =
      research && typeof research.answer === "string" && research.answer.trim()
        ? research.answer.trim()
        : research && typeof research.summary === "string" && research.summary.trim()
          ? research.summary.trim()
          : null;
    const documentSummary = (() => {
      const documents = input.agentContext.priorResults.DOCUMENT;
      if (!documents || typeof documents !== "object") return null;
      const row = documents as Record<string, unknown>;
      if (typeof row.summary === "string" && row.summary.trim()) {
        return row.summary.trim();
      }
      if (typeof row.analysis === "string" && row.analysis.trim()) {
        return row.analysis.trim();
      }
      return null;
    })();
    const draftSummary = (() => {
      const draft = input.agentContext.priorResults.DRAFTING;
      if (!draft || typeof draft !== "object") return null;
      const row = draft as Record<string, unknown>;
      if (typeof row.full_text === "string" && row.full_text.trim()) {
        return row.full_text.trim();
      }
      if (typeof row.summary === "string" && row.summary.trim()) {
        return row.summary.trim();
      }
      return null;
    })();
    const reviewSummary =
      review && typeof review.summary === "string" ? review.summary.trim() : null;
    const stepSummary =
      stepResults.find((result) => result.summary.trim())?.summary ?? null;
    // Prefer the primary work product for any task shape: research answer,
    // document analysis, or draft text. Review meta-summaries come last.
    const primarySummary =
      researchAnswer ?? documentSummary ?? draftSummary ?? reviewSummary ?? stepSummary;

    const finalResult = {
      workflow: plan.workflow,
      goal: plan.goal ?? resolvedTask,
      planSource: plan.source,
      incomplete,
      summary: primarySummary,
      answer: researchAnswer,
      resolvedRequest: resolvedTask,
      researchTarget: conversation.target,
      conversationRelation: conversation.relation,
      steps: stepResults.map((result) => ({
        agentType: result.agentType,
        summary: result.summary,
        statusSummary: result.statusSummary,
        openQuestions: result.openQuestions,
        requiresApproval: result.requiresApproval,
        incomplete: result.incomplete === true,
        output: result.output,
      })),
      evidenceIds: [
        ...new Set(stepResults.flatMap((result) => result.evidenceIds)),
      ],
      citationIds: [
        ...new Set(stepResults.flatMap((result) => result.citationIds)),
      ],
      citations: input.agentContext.citations,
      draft: input.agentContext.priorResults.DRAFTING ?? null,
      review,
      research,
      documents: input.agentContext.priorResults.DOCUMENT ?? null,
    };

    if (approvalId) {
      await updateAgentRun({
        id: input.runId,
        status: "WAITING_FOR_APPROVAL",
        result: {
          ...finalResult,
          approvalId,
        },
      });
    } else if (incomplete) {
      await updateAgentRun({
        id: input.runId,
        status: "INCOMPLETE",
        result: finalResult,
        errorSummary: "Agent run stopped due to limits or incomplete tool work",
        completed: true,
      });
      await writeAgentAudit({
        workspaceId: input.agentContext.workspaceId,
        matterId: input.agentContext.matterId,
        agentRunId: input.runId,
        actorUserId: input.agentContext.user.userId,
        action: "agent_run.incomplete",
        metadata: { workflow: plan.workflow },
      });
    } else {
      await updateAgentRun({
        id: input.runId,
        status: "COMPLETED",
        result: finalResult,
        completed: true,
      });
      await writeAgentAudit({
        workspaceId: input.agentContext.workspaceId,
        matterId: input.agentContext.matterId,
        agentRunId: input.runId,
        actorUserId: input.agentContext.user.userId,
        action: "agent_run.completed",
        metadata: { workflow: plan.workflow },
      });
    }

    return this.toView(input.runId, approvalId);
  }

  async toView(runId: string, approvalId: string | null = null): Promise<AgentRunView> {
    const {
      getAgentRunById,
      listApprovalRequestsForRun,
      listAgentSteps,
    } = await import("@/modules/agents/repository");
    const run = await getAgentRunById(runId);
    if (!run) {
      throw validationError("Agent run not found");
    }
    const steps = await listAgentSteps(runId);
    const approvals = await listApprovalRequestsForRun(runId);
    const pending = approvals.find((item) => item.status === "PENDING");

    return {
      runId: run.id,
      status: run.status,
      task: run.task,
      plan: (run.plan ?? {}) as ExecutionPlan,
      result: run.result,
      errorSummary: run.errorSummary,
      approvalId: approvalId ?? pending?.id ?? null,
      steps: steps.map((step) => ({
        sequence: step.sequence,
        agentType: step.agentType,
        action: step.action,
        tool: step.tool,
        status: step.status,
        summary:
          typeof step.outputMetadata?.summary === "string"
            ? step.outputMetadata.summary
            : undefined,
        createdAt: step.createdAt,
      })),
    };
  }
}

export function getOrchestratorService() {
  return new OrchestratorService();
}
