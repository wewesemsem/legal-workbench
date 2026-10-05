import { jsonError, jsonOk } from "@/lib/api";
import {
  listMatterAgentConversations,
  listMatterAgentRuns,
  listPendingMatterApprovals,
} from "@/modules/agents/service";
import { requireAuthContext } from "@/modules/auth/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const [runs, conversations, approvals] = await Promise.all([
      listMatterAgentRuns({ matterId, context: auth }),
      listMatterAgentConversations({ matterId, context: auth }),
      listPendingMatterApprovals({ matterId, context: auth }),
    ]);
    return jsonOk({
      runs,
      conversations,
      pending_approvals: approvals.map((approval) => ({
        id: approval.id,
        action: approval.action,
        risk_level: approval.riskLevel,
        description: approval.description,
        status: approval.status,
        agent_run_id: approval.agentRunId,
        proposed_output: approval.proposedOutput,
        requested_at: approval.requestedAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
