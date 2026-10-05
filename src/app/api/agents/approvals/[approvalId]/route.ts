import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import {
  decideApproval,
  getApprovalForUser,
} from "@/modules/agents/service";
import { requireAuthContext } from "@/modules/auth/service";

const bodySchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "EDITED"]),
    edited_output: z.record(z.string(), z.unknown()).optional(),
    review_note: z.string().trim().max(4_000).optional(),
  })
  .strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { approvalId } = await context.params;
    const approval = await getApprovalForUser({ approvalId, context: auth });
    return jsonOk({
      id: approval.id,
      workspace_id: approval.workspaceId,
      matter_id: approval.matterId,
      agent_run_id: approval.agentRunId,
      action: approval.action,
      risk_level: approval.riskLevel,
      description: approval.description,
      proposed_output: approval.proposedOutput,
      edited_output: approval.editedOutput,
      status: approval.status,
      requested_at: approval.requestedAt,
      reviewed_at: approval.reviewedAt,
      review_note: approval.reviewNote,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { approvalId } = await context.params;
    const body = bodySchema.parse(await request.json());
    const approval = await decideApproval({
      approvalId,
      decision: body.decision,
      editedOutput: body.edited_output,
      reviewNote: body.review_note,
      context: auth,
    });
    return jsonOk({
      id: approval?.id,
      status: approval?.status,
      edited_output: approval?.editedOutput,
      reviewed_at: approval?.reviewedAt,
    });
  } catch (error) {
    return jsonError(error);
  }
}
