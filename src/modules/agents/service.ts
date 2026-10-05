import { reviewApprovalRequest, listMatterApprovals } from "@/modules/agents/approval";
import {
  getOrchestratorService,
  type PreparedAgentRun,
} from "@/modules/agents/orchestrator";
import {
  getAgentRunById,
  getApprovalRequestById,
  listAgentConversationsForMatter,
  listAgentRunsForConversation,
  listAgentRunsForMatter,
  listAgentSteps,
  listApprovalRequestsForRun,
} from "@/modules/agents/repository";
import type { AgentType, ApprovalStatus } from "@/modules/agents/types";
import { forbidden, notFound } from "@/modules/authorization/errors";
import {
  assertConversationAccess,
  assertMatterAccess,
  type AuthContext,
} from "@/modules/authorization/permissions";

export async function startAgentRun(input: {
  matterId: string;
  task: string;
  agentType?: AgentType;
  conversationId?: string | null;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  context: AuthContext;
}) {
  return getOrchestratorService().startRun(input);
}

export async function prepareAgentRun(input: {
  matterId: string;
  task: string;
  agentType?: AgentType;
  conversationId?: string | null;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  context: AuthContext;
}): Promise<PreparedAgentRun> {
  return getOrchestratorService().prepareRun(input);
}

export async function getAgentRunForUser(input: {
  runId: string;
  context: AuthContext;
}) {
  const run = await getAgentRunById(input.runId);
  if (!run) {
    throw notFound("Agent run not found");
  }

  await assertMatterAccess({
    matterId: run.matterId,
    context: input.context,
  });

  const steps = await listAgentSteps(run.id);
  const approvals = await listApprovalRequestsForRun(run.id);
  const pending = approvals.find((item) => item.status === "PENDING");

  return {
    runId: run.id,
    workspaceId: run.workspaceId,
    matterId: run.matterId,
    status: run.status,
    agentType: run.agentType,
    task: run.task,
    plan: run.plan,
    result: run.result,
    errorSummary: run.errorSummary,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    approvalId: pending?.id ?? null,
    approvals: approvals.map((approval) => ({
      id: approval.id,
      action: approval.action,
      riskLevel: approval.riskLevel,
      description: approval.description,
      status: approval.status,
      proposedOutput: approval.proposedOutput,
      editedOutput: approval.editedOutput,
      requestedAt: approval.requestedAt,
      reviewedAt: approval.reviewedAt,
      reviewNote: approval.reviewNote,
    })),
    steps: steps.map((step) => ({
      id: step.id,
      sequence: step.sequence,
      agentType: step.agentType,
      action: step.action,
      tool: step.tool,
      status: step.status,
      summary:
        typeof step.outputMetadata?.summary === "string"
          ? step.outputMetadata.summary
          : step.action,
      createdAt: step.createdAt,
    })),
  };
}

export async function listMatterAgentRuns(input: {
  matterId: string;
  context: AuthContext;
}) {
  await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });
  const runs = await listAgentRunsForMatter(input.matterId);
  return runs.map((run) => ({
    runId: run.id,
    status: run.status,
    agentType: run.agentType,
    task: run.task,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    conversationId: run.conversationId,
    workflow:
      typeof run.plan?.workflow === "string" ? run.plan.workflow : null,
  }));
}

export async function listMatterAgentConversations(input: {
  matterId: string;
  context: AuthContext;
}) {
  await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });
  const rows = await listAgentConversationsForMatter(input.matterId);
  return rows.map((row) => {
    const title =
      row.title && row.title !== "New conversation"
        ? row.title
        : row.firstTask || row.latestTask || "Conversation";
    return {
      conversationId: row.conversationId,
      title,
      status: row.latestStatus,
      preview: row.firstTask || row.latestTask || title,
      runCount: row.runCount,
      updatedAt: row.latestRunAt ?? row.updatedAt,
      createdAt: row.createdAt,
    };
  });
}

export async function listMatterAgentConversationRuns(input: {
  matterId: string;
  conversationId: string;
  context: AuthContext;
}) {
  const access = await assertConversationAccess({
    conversationId: input.conversationId,
    context: input.context,
  });
  if (access.matterId !== input.matterId) {
    throw forbidden("Conversation does not belong to this matter");
  }

  const runs = await listAgentRunsForConversation(input.conversationId);
  const detailed = await Promise.all(
    runs.map(async (run) => getAgentRunForUser({ runId: run.id, context: input.context })),
  );
  return detailed;
}

export async function decideApproval(input: {
  approvalId: string;
  decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED" | "EDITED">;
  editedOutput?: Record<string, unknown>;
  reviewNote?: string;
  context: AuthContext;
}) {
  return reviewApprovalRequest(input);
}

export async function getApprovalForUser(input: {
  approvalId: string;
  context: AuthContext;
}) {
  const approval = await getApprovalRequestById(input.approvalId);
  if (!approval) {
    throw notFound("Approval request not found");
  }
  await assertMatterAccess({
    matterId: approval.matterId,
    context: input.context,
  });
  return approval;
}

export async function listPendingMatterApprovals(input: {
  matterId: string;
  context: AuthContext;
}) {
  return listMatterApprovals(input);
}

export async function assertNoCrossMatterToolAccess(input: {
  requestedMatterId: string;
  authorizedMatterId: string;
}) {
  if (input.requestedMatterId !== input.authorizedMatterId) {
    throw forbidden("Cross-matter access denied");
  }
}
