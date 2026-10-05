import { jsonError, jsonOk } from "@/lib/api";
import { listMatterAgentConversationRuns } from "@/modules/agents/service";
import { requireAuthContext } from "@/modules/auth/service";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ matterId: string; conversationId: string }>;
  },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId, conversationId } = await context.params;
    const runs = await listMatterAgentConversationRuns({
      matterId,
      conversationId,
      context: auth,
    });
    return jsonOk({
      conversation_id: conversationId,
      runs: runs.map((run) => ({
        run_id: run.runId,
        workspace_id: run.workspaceId,
        matter_id: run.matterId,
        status: run.status,
        agent_type: run.agentType,
        task: run.task,
        plan: run.plan,
        result: run.result,
        error_summary: run.errorSummary,
        approval_id: run.approvalId,
        approvals: run.approvals,
        steps: run.steps,
        started_at: run.startedAt,
        completed_at: run.completedAt,
        created_at: run.createdAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
