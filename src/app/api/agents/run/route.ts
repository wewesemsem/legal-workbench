import { after } from "next/server";
import { z } from "zod";

import { jsonCreated, jsonError } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAgentEnv } from "@/modules/agents/config";
import { prepareAgentRun } from "@/modules/agents/service";
import { requireAuthContext } from "@/modules/auth/service";
import { rateLimited } from "@/modules/authorization/errors";

export const maxDuration = 300;

const bodySchema = z
  .object({
    matter_id: z.string().trim().min(1).max(80),
    task: z.string().trim().min(1).max(8_000),
    agent_type: z
      .enum(["ORCHESTRATOR", "RESEARCH", "DOCUMENT", "DRAFTING", "REVIEW"])
      .default("ORCHESTRATOR"),
    conversation_id: z.string().trim().min(1).max(80).optional(),
    conversation_history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(8_000),
          })
          .strict(),
      )
      .max(40)
      .optional(),
  })
  .strict();

function serializeRunView(result: {
  runId: string;
  status: string;
  approvalId: string | null;
  plan: unknown;
  steps: unknown;
  result: unknown;
}) {
  return {
    run_id: result.runId,
    status: result.status,
    approval_id: result.approvalId,
    plan: result.plan,
    steps: result.steps,
    result: result.result,
  };
}

function shouldWaitForCompletion() {
  return (
    process.env.VITEST === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.AGENT_RUN_WAIT === "1"
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const agentEnv = getAgentEnv();
    const limit = checkRateLimit(
      `agents-run:${auth.userId}:${getClientIp(request.headers)}`,
      agentEnv.AGENT_RATE_LIMIT_MAX_ATTEMPTS,
      agentEnv.AGENT_RATE_LIMIT_WINDOW_MS,
    );
    if (!limit.allowed) {
      throw rateLimited();
    }

    const body = bodySchema.parse(await request.json());
    const prepared = await prepareAgentRun({
      matterId: body.matter_id,
      task: body.task,
      agentType: body.agent_type,
      conversationId: body.conversation_id,
      conversationHistory: body.conversation_history,
      context: auth,
    });

    // Tests and local scripts call the route handler directly and expect a
    // completed payload. In the app, return immediately so the UI can poll
    // live steps while execution continues via after().
    if (shouldWaitForCompletion()) {
      const result = await prepared.execute();
      return jsonCreated(serializeRunView(result));
    }

    after(() => {
      void prepared.execute().catch(() => {
        // Failure is persisted on the agent run; avoid unhandled rejection.
      });
    });

    return jsonCreated(serializeRunView(prepared.view));
  } catch (error) {
    return jsonError(error);
  }
}
