import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  agentRuns,
  agentSteps,
  approvalRequests,
  conversations,
} from "@/lib/db/schema";
import type {
  AgentRunStatus,
  AgentStepStatus,
  AgentType,
  ApprovalStatus,
  ToolRiskLevel,
} from "@/modules/agents/types";

export async function createAgentRun(input: {
  id: string;
  workspaceId: string;
  matterId: string;
  conversationId?: string | null;
  initiatedBy: string;
  agentType: AgentType;
  task: string;
  status?: AgentRunStatus;
  plan?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();
  await db.insert(agentRuns).values({
    id: input.id,
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    conversationId: input.conversationId ?? null,
    initiatedBy: input.initiatedBy,
    agentType: input.agentType,
    task: input.task,
    status: input.status ?? "PENDING",
    plan: input.plan ?? {},
    metadata: input.metadata ?? {},
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  if (input.conversationId) {
    await db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, input.conversationId));
  }

  return input.id;
}

export async function updateAgentRun(input: {
  id: string;
  status?: AgentRunStatus;
  plan?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  errorSummary?: string | null;
  metadata?: Record<string, unknown>;
  completed?: boolean;
}) {
  const patch: Partial<typeof agentRuns.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.status) patch.status = input.status;
  if (input.plan) patch.plan = input.plan;
  if (input.result !== undefined) patch.result = input.result;
  if (input.errorSummary !== undefined) patch.errorSummary = input.errorSummary;
  if (input.metadata) patch.metadata = input.metadata;
  if (input.completed) patch.completedAt = new Date();

  await db.update(agentRuns).set(patch).where(eq(agentRuns.id, input.id));
}

export async function getAgentRunById(id: string) {
  const rows = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAgentRunsForMatter(matterId: string, limit = 20) {
  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.matterId, matterId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

export async function listAgentRunsForConversation(
  conversationId: string,
  limit = 100,
) {
  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.conversationId, conversationId))
    .orderBy(asc(agentRuns.createdAt))
    .limit(limit);
}

/**
 * Conversations that have at least one agent run, ordered by latest activity.
 * Used for Matter AI "Recent work" (conversation-level, not per-message).
 */
export async function listAgentConversationsForMatter(
  matterId: string,
  limit = 20,
) {
  const linkedRuns = await db
    .select({
      conversationId: agentRuns.conversationId,
      task: agentRuns.task,
      status: agentRuns.status,
      createdAt: agentRuns.createdAt,
    })
    .from(agentRuns)
    .where(
      and(eq(agentRuns.matterId, matterId), isNotNull(agentRuns.conversationId)),
    )
    .orderBy(desc(agentRuns.createdAt))
    .limit(Math.max(limit * 20, 100));

  const byConversation = new Map<
    string,
    {
      conversationId: string;
      firstTask: string;
      latestTask: string;
      latestStatus: string;
      latestRunAt: Date;
      runCount: number;
    }
  >();

  for (const run of linkedRuns) {
    const conversationId = run.conversationId;
    if (!conversationId) continue;
    const existing = byConversation.get(conversationId);
    if (!existing) {
      byConversation.set(conversationId, {
        conversationId,
        firstTask: run.task,
        latestTask: run.task,
        latestStatus: run.status,
        latestRunAt: run.createdAt,
        runCount: 1,
      });
      continue;
    }
    existing.runCount += 1;
    // Runs are newest-first; keep firstTask as the oldest seen so far.
    existing.firstTask = run.task;
  }

  const conversationIds = [...byConversation.keys()].slice(0, limit);
  if (!conversationIds.length) return [];

  const conversationRows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(inArray(conversations.id, conversationIds));

  const conversationById = new Map(
    conversationRows.map((row) => [row.id, row]),
  );

  return conversationIds
    .map((conversationId) => {
      const stats = byConversation.get(conversationId);
      const conversation = conversationById.get(conversationId);
      if (!stats || !conversation) return null;
      return {
        conversationId,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        runCount: stats.runCount,
        latestRunAt: stats.latestRunAt,
        latestStatus: stats.latestStatus,
        latestTask: stats.latestTask,
        firstTask: stats.firstTask,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort(
      (left, right) =>
        right.latestRunAt.getTime() - left.latestRunAt.getTime(),
    )
    .slice(0, limit);
}

export async function createAgentStep(input: {
  agentRunId: string;
  sequence: number;
  agentType: AgentType;
  action: string;
  tool?: string | null;
  inputMetadata?: Record<string, unknown>;
  outputMetadata?: Record<string, unknown>;
  status?: AgentStepStatus;
}) {
  const id = crypto.randomUUID();
  await db.insert(agentSteps).values({
    id,
    agentRunId: input.agentRunId,
    sequence: input.sequence,
    agentType: input.agentType,
    action: input.action,
    tool: input.tool ?? null,
    inputMetadata: input.inputMetadata ?? {},
    outputMetadata: input.outputMetadata ?? {},
    status: input.status ?? "COMPLETED",
    createdAt: new Date(),
  });
  return id;
}

export async function updateAgentStep(input: {
  id: string;
  action?: string;
  tool?: string | null;
  inputMetadata?: Record<string, unknown>;
  outputMetadata?: Record<string, unknown>;
  status?: AgentStepStatus;
}) {
  const patch: Partial<typeof agentSteps.$inferInsert> = {};
  if (input.action !== undefined) patch.action = input.action;
  if (input.tool !== undefined) patch.tool = input.tool;
  if (input.inputMetadata !== undefined) {
    patch.inputMetadata = input.inputMetadata;
  }
  if (input.outputMetadata !== undefined) {
    patch.outputMetadata = input.outputMetadata;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (!Object.keys(patch).length) return;
  await db.update(agentSteps).set(patch).where(eq(agentSteps.id, input.id));
}

export async function listAgentSteps(agentRunId: string) {
  return db
    .select()
    .from(agentSteps)
    .where(eq(agentSteps.agentRunId, agentRunId))
    .orderBy(asc(agentSteps.sequence));
}

export async function createApprovalRequest(input: {
  id: string;
  workspaceId: string;
  matterId: string;
  agentRunId: string;
  action: string;
  riskLevel: ToolRiskLevel;
  description: string;
  proposedOutput: Record<string, unknown>;
}) {
  const now = new Date();
  await db.insert(approvalRequests).values({
    id: input.id,
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    agentRunId: input.agentRunId,
    action: input.action,
    riskLevel: input.riskLevel,
    description: input.description,
    proposedOutput: input.proposedOutput,
    status: "PENDING",
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return input.id;
}

export async function getApprovalRequestById(id: string) {
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listApprovalRequestsForRun(agentRunId: string) {
  return db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.agentRunId, agentRunId))
    .orderBy(desc(approvalRequests.createdAt));
}

export async function listPendingApprovalsForMatter(matterId: string) {
  return db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.matterId, matterId),
        eq(approvalRequests.status, "PENDING"),
      ),
    )
    .orderBy(desc(approvalRequests.requestedAt));
}

export async function updateApprovalRequest(input: {
  id: string;
  status: ApprovalStatus;
  reviewedBy: string;
  editedOutput?: Record<string, unknown> | null;
  reviewNote?: string | null;
}) {
  await db
    .update(approvalRequests)
    .set({
      status: input.status,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      editedOutput: input.editedOutput ?? null,
      reviewNote: input.reviewNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(approvalRequests.id, input.id));
}
