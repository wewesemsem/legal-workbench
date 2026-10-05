import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AIWorkspace } from "@/components/workbench/ai-workspace";
import { requireAuthContext } from "@/modules/auth/service";
import {
  listMatterAgentConversations,
  listMatterAgentRuns,
  listPendingMatterApprovals,
} from "@/modules/agents/service";
import { listMatterDocuments } from "@/modules/documents/service";
import { getMatterForUser } from "@/modules/matters/service";
import { listMatterMemory, listPendingConflicts } from "@/modules/memory";

export default async function MatterAiPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
  searchParams: Promise<{ run?: string; task?: string }>;
}) {
  const { matterId } = await params;
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  let matter;
  try {
    matter = await getMatterForUser({ matterId, context });
  } catch {
    redirect("/app/matters");
  }

  const [
    documents,
    agentRuns,
    agentConversations,
    pendingApprovals,
    matterMemory,
    memoryConflicts,
  ] = await Promise.all([
    listMatterDocuments({ matterId, context }),
    listMatterAgentRuns({ matterId, context }),
    listMatterAgentConversations({ matterId, context }),
    listPendingMatterApprovals({ matterId, context }),
    listMatterMemory({ matterId, context, includePending: true }),
    listPendingConflicts({ matterId, context }),
  ]);

  const canManage = matter.memberRole === "LAWYER";
  const drafts = agentRuns.filter(
    (run) =>
      run.status === "COMPLETED" || run.status === "WAITING_FOR_APPROVAL",
  );

  return (
    <Suspense
      fallback={
        <p className="text-sm text-stone-600">Loading Matter AI…</p>
      }
    >
      <AIWorkspace
        matterId={matterId}
        matterTitle={matter.title}
        canManage={canManage}
        initialConversations={agentConversations.map((conversation) => ({
          ...conversation,
          updatedAt:
            conversation.updatedAt instanceof Date
              ? conversation.updatedAt.toISOString()
              : String(conversation.updatedAt),
          createdAt:
            conversation.createdAt instanceof Date
              ? conversation.createdAt.toISOString()
              : String(conversation.createdAt),
        }))}
        initialApprovals={pendingApprovals.map((approval) => ({
          id: approval.id,
          action: approval.action,
          risk_level: approval.riskLevel,
          description: approval.description,
          status: approval.status,
          agent_run_id: approval.agentRunId,
          proposed_output: approval.proposedOutput ?? {},
          requested_at: approval.requestedAt.toISOString(),
        }))}
        contextMemories={matterMemory.map((item) => ({
          id: item.id,
          key: item.key,
          value: item.value,
          type: item.type,
          source_type: item.sourceType,
          confidence: item.confidence,
          status: item.status,
          confirmed_at: item.confirmedAt
            ? item.confirmedAt.toISOString()
            : null,
          confirmed_by: item.confirmedBy,
        }))}
        contextConflicts={memoryConflicts.map((conflict) => ({
          id: conflict.id,
          existing_memory_id: conflict.existingMemoryId,
          proposed_key: conflict.proposedKey,
          proposed_value: conflict.proposedValue,
          proposed_source_type: conflict.proposedSourceType,
          status: conflict.status,
        }))}
        counts={{
          documents: documents.length,
          research: agentRuns.filter((run) =>
            (run.workflow ?? run.agentType).toLowerCase().includes("research"),
          ).length,
          drafts: drafts.length,
          memory: matterMemory.filter((item) => item.status === "ACTIVE").length,
        }}
        documents={documents.map((document) => ({
          id: document.id,
          originalFilename: document.originalFilename,
          processingStatus: document.processingStatus,
        }))}
      />
    </Suspense>
  );
}
