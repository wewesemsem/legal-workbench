import { db } from "@/lib/db";
import { agentAuditEvents } from "@/lib/db/schema";

export async function writeAgentAudit(input: {
  workspaceId: string;
  matterId: string;
  agentRunId?: string | null;
  actorUserId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(agentAuditEvents).values({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    agentRunId: input.agentRunId ?? null,
    actorUserId: input.actorUserId,
    action: input.action,
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  });
}
