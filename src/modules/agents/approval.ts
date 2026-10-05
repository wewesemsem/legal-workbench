import { forbidden, notFound, validationError } from "@/modules/authorization/errors";
import {
  assertMatterAccess,
  type AuthContext,
} from "@/modules/authorization/permissions";
import { writeAgentAudit } from "@/modules/agents/audit";
import { buildAgentPermissions } from "@/modules/agents/permissions";
import {
  createApprovalRequest,
  getAgentRunById,
  getApprovalRequestById,
  listPendingApprovalsForMatter,
  updateAgentRun,
  updateApprovalRequest,
} from "@/modules/agents/repository";
import type { ApprovalStatus, ToolRiskLevel } from "@/modules/agents/types";
import {
  confirmMemory,
  deleteMemory,
  updateMemory,
} from "@/modules/memory";

export async function requestHumanApproval(input: {
  workspaceId: string;
  matterId: string;
  agentRunId: string;
  action: string;
  description: string;
  proposedOutput: Record<string, unknown>;
  riskLevel?: ToolRiskLevel;
  actorUserId: string;
}) {
  if (input.riskLevel === "EXTERNAL_ACTION") {
    throw forbidden(
      "High-risk external actions cannot execute without an implemented approval workflow",
    );
  }

  const id = crypto.randomUUID();
  await createApprovalRequest({
    id,
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    agentRunId: input.agentRunId,
    action: input.action,
    riskLevel: input.riskLevel ?? "WRITE",
    description: input.description,
    proposedOutput: input.proposedOutput,
  });

  await updateAgentRun({
    id: input.agentRunId,
    status: "WAITING_FOR_APPROVAL",
  });

  await writeAgentAudit({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    agentRunId: input.agentRunId,
    actorUserId: input.actorUserId,
    action: "approval.requested",
    metadata: { approvalId: id, action: input.action },
  });

  return id;
}

export async function reviewApprovalRequest(input: {
  approvalId: string;
  decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED" | "EDITED">;
  editedOutput?: Record<string, unknown>;
  reviewNote?: string;
  context: AuthContext;
}) {
  const approval = await getApprovalRequestById(input.approvalId);
  if (!approval) {
    throw notFound("Approval request not found");
  }

  const matterAccess = await assertMatterAccess({
    matterId: approval.matterId,
    context: input.context,
  });
  const permissions = buildAgentPermissions({
    context: input.context,
    matterRole: matterAccess.memberRole,
  });
  if (!permissions.canApprove) {
    throw forbidden("Only lawyers can approve agent actions");
  }

  if (approval.status !== "PENDING") {
    throw validationError("Approval request is no longer pending");
  }

  if (input.decision === "EDITED" && !input.editedOutput) {
    throw validationError("editedOutput is required when decision is EDITED");
  }

  await updateApprovalRequest({
    id: approval.id,
    status: input.decision,
    reviewedBy: input.context.userId,
    editedOutput: input.decision === "EDITED" ? input.editedOutput : null,
    reviewNote: input.reviewNote ?? null,
  });

  if (approval.action === "save_matter_memory") {
    await applyMemoryApprovalDecision({
      approval,
      decision: input.decision,
      editedOutput: input.editedOutput,
      context: input.context,
    });
  }

  const run = await getAgentRunById(approval.agentRunId);
  if (run) {
    const finalOutput =
      input.decision === "REJECTED"
        ? {
            ...(run.result ?? {}),
            approvalStatus: "REJECTED",
            approvalNote: input.reviewNote ?? "Rejected by lawyer",
          }
        : {
            ...(run.result ?? {}),
            approvalStatus: input.decision,
            finalDraft:
              approval.action === "save_matter_memory"
                ? undefined
                : input.decision === "EDITED"
                  ? input.editedOutput
                  : approval.proposedOutput,
            finalMemory:
              approval.action === "save_matter_memory"
                ? input.decision === "EDITED"
                  ? input.editedOutput
                  : approval.proposedOutput
                : undefined,
          };

    await updateAgentRun({
      id: run.id,
      status: input.decision === "REJECTED" ? "CANCELLED" : "COMPLETED",
      result: finalOutput,
      completed: true,
    });
  }

  await writeAgentAudit({
    workspaceId: approval.workspaceId,
    matterId: approval.matterId,
    agentRunId: approval.agentRunId,
    actorUserId: input.context.userId,
    action:
      input.decision === "APPROVED"
        ? "approval.granted"
        : input.decision === "REJECTED"
          ? "approval.rejected"
          : "approval.edited",
    metadata: { approvalId: approval.id },
  });

  return getApprovalRequestById(approval.id);
}

export async function listMatterApprovals(input: {
  matterId: string;
  context: AuthContext;
}) {
  await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });
  return listPendingApprovalsForMatter(input.matterId);
}

async function applyMemoryApprovalDecision(input: {
  approval: {
    agentRunId: string;
    proposedOutput: Record<string, unknown>;
  };
  decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED" | "EDITED">;
  editedOutput?: Record<string, unknown>;
  context: AuthContext;
}) {
  const proposed = input.approval.proposedOutput;
  const memoryId =
    typeof proposed.memory_id === "string" ? proposed.memory_id : null;
  if (!memoryId) {
    throw validationError("Memory approval is missing memory_id");
  }

  if (input.decision === "REJECTED") {
    await deleteMemory({ memoryId, context: input.context });
    return;
  }

  if (input.decision === "EDITED") {
    const value =
      typeof input.editedOutput?.value === "string"
        ? input.editedOutput.value
        : typeof proposed.value === "string"
          ? proposed.value
          : null;
    if (!value?.trim()) {
      throw validationError("Edited memory value is required");
    }
    await updateMemory({
      memoryId,
      value: value.trim(),
      context: input.context,
    });
  }

  await confirmMemory({
    memoryId,
    context: input.context,
    agentRunId: input.approval.agentRunId,
  });
}
