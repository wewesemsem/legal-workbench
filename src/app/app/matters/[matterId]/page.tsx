import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UpdateMatterForm } from "@/components/matters/update-matter-form";
import { ActivityTimeline } from "@/components/workbench/activity-timeline";
import { EmptyState } from "@/components/workbench/empty-state";
import { MatterContextPanel } from "@/components/workbench/matter-context-panel";
import { matterStatusLabel } from "@/components/workbench/labels";
import { requireAuthContext } from "@/modules/auth/service";
import { listMatterAgentRuns } from "@/modules/agents/service";
import { listMatterDocuments } from "@/modules/documents/service";
import { getRequestI18n } from "@/modules/i18n/server";
import {
  getMatterForUser,
  listMatterParticipants,
} from "@/modules/matters/service";
import { listMatterMemory, listPendingConflicts } from "@/modules/memory";
import { MATTER_TYPE_LABELS } from "@/modules/matters/types";
import { buildMatterActivity } from "@/modules/workbench/queries";

export default async function MatterOverviewPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const { matterId } = await params;
  const { t, locale } = await getRequestI18n();
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
    participants,
    agentRuns,
    matterMemory,
    memoryConflicts,
    activity,
  ] = await Promise.all([
    listMatterDocuments({ matterId, context }),
    listMatterParticipants({ matterId, context }),
    listMatterAgentRuns({ matterId, context }),
    listMatterMemory({ matterId, context, includePending: true }),
    listPendingConflicts({ matterId, context }),
    buildMatterActivity({ matterId, context }),
  ]);

  const canManage = matter.memberRole === "LAWYER";
  const drafts = agentRuns.filter(
    (run) =>
      run.status === "COMPLETED" || run.status === "WAITING_FOR_APPROVAL",
  );
  const latestCompleted = agentRuns.find((run) => run.status === "COMPLETED");
  const confirmedMemory = matterMemory.filter(
    (item) => item.status === "ACTIVE",
  );

  return (
    <div
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"
      data-tour="matter-overview"
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-stone-900">
                {t.whereThingsStand}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {t.status}: {matterStatusLabel(matter.status, t)} ·{" "}
                {MATTER_TYPE_LABELS[matter.matterType]}
              </p>
            </div>
            <Link
              href={`/app/matters/${matterId}/ai`}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {t.askAi}
            </Link>
          </div>

          <div className="mt-6 border-t border-stone-200 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
              {t.aiSummary}
            </h3>
            {matter.description || latestCompleted ? (
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {matter.description || latestCompleted?.task}
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-600">{t.askAiForSummary}</p>
            )}
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/app/matters/${matterId}/ai?task=${encodeURIComponent("Review the key documents in this matter against Egyptian law and identify concerns.")}`}
              className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm hover:bg-stone-50"
            >
              {t.reviewADocument}
            </Link>
            <Link
              href={`/app/matters/${matterId}/ai?task=${encodeURIComponent("Research the key legal issues in this matter.")}`}
              className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm hover:bg-stone-50"
            >
              {t.researchAnIssue}
            </Link>
            <Link
              href={`/app/matters/${matterId}/ai?task=${encodeURIComponent("Draft a response letter addressing the key issues in this matter.")}`}
              className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm hover:bg-stone-50"
            >
              {t.draftADocument}
            </Link>
            <Link
              href={`/app/matters/${matterId}/documents`}
              className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm hover:bg-stone-50"
            >
              {t.uploadDocuments}
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-6">
          <h2 className="text-lg font-medium text-stone-900">
            {t.recentActivity}
          </h2>
          <div className="mt-4">
            {activity.length ? (
              <ActivityTimeline
                items={activity.slice(0, 8)}
                t={t}
                locale={locale}
              />
            ) : (
              <EmptyState
                title={t.noActivityTitle}
                description={t.noActivityBody}
                actionLabel={t.askAi}
                actionHref={`/app/matters/${matterId}/ai`}
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-6">
          <h2 className="text-lg font-medium text-stone-900">
            {t.participants}
          </h2>
          <ul className="mt-4 space-y-2">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-stone-900">
                  {participant.firstName} {participant.lastName}
                </span>
                <span className="text-stone-500"> · {participant.email}</span>
              </li>
            ))}
          </ul>

          {canManage ? (
            <div className="mt-6 border-t border-stone-200 pt-6">
              <h3 className="text-sm font-medium text-stone-900">
                {t.updateMatter}
              </h3>
              <div className="mt-3 max-w-lg">
                <UpdateMatterForm
                  matterId={matter.id}
                  initialTitle={matter.title}
                  initialDescription={matter.description}
                  initialStatus={matter.status}
                  initialMatterType={matter.matterType}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <MatterContextPanel
        matterId={matterId}
        canManage={canManage}
        initialMemories={matterMemory.map((item) => ({
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
        initialConflicts={memoryConflicts.map((conflict) => ({
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
          memory: confirmedMemory.length,
        }}
      />
    </div>
  );
}
