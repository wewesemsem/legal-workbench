import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DraftEditor } from "@/components/workbench/draft-editor";
import { requireAuthContext } from "@/modules/auth/service";
import {
  getAgentRunForUser,
  listPendingMatterApprovals,
} from "@/modules/agents/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { getMatterForUser } from "@/modules/matters/service";

export default async function DraftEditorPage({
  params,
}: {
  params: Promise<{ matterId: string; runId: string }>;
}) {
  const { matterId, runId } = await params;
  const { t } = await getRequestI18n();
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

  let run;
  try {
    run = await getAgentRunForUser({ runId, context });
  } catch {
    redirect(`/app/matters/${matterId}/drafts`);
  }

  if (run.matterId !== matterId) {
    redirect(`/app/matters/${matterId}/drafts`);
  }

  const pendingApprovals = await listPendingMatterApprovals({
    matterId,
    context,
  });

  const draft =
    run.result &&
    typeof run.result === "object" &&
    run.result.draft &&
    typeof run.result.draft === "object"
      ? (run.result.draft as { full_text?: string })
      : null;
  const initialText =
    typeof draft?.full_text === "string"
      ? draft.full_text
      : `${t.draftLabel}:\n${run.task}`;

  return (
    <div className="space-y-4">
      <Link
        href={`/app/matters/${matterId}/drafts`}
        className="text-sm text-stone-600 hover:text-stone-900"
      >
        ← {t.backToDrafts}
      </Link>
      <DraftEditor
        matterId={matterId}
        matterTitle={matter.title}
        runId={runId}
        canManage={matter.memberRole === "LAWYER"}
        initialText={initialText}
        initialApprovals={pendingApprovals
          .filter((approval) => approval.agentRunId === runId)
          .map((approval) => ({
            id: approval.id,
            action: approval.action,
            risk_level: approval.riskLevel,
            description: approval.description,
            status: approval.status,
            agent_run_id: approval.agentRunId,
            proposed_output: approval.proposedOutput ?? {},
            requested_at: approval.requestedAt.toISOString(),
          }))}
      />
    </div>
  );
}
