import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/workbench/empty-state";
import { aiStatusLabel } from "@/components/workbench/labels";
import { StatusBadge, aiStatusTone } from "@/components/workbench/status-badge";
import { requireAuthContext } from "@/modules/auth/service";
import { listMatterAgentRuns } from "@/modules/agents/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { getMatterForUser } from "@/modules/matters/service";

export default async function MatterDraftsPage({
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

  try {
    await getMatterForUser({ matterId, context });
  } catch {
    redirect("/app/matters");
  }

  const agentRuns = await listMatterAgentRuns({ matterId, context });
  const drafts = agentRuns.filter((run) => {
    const haystack =
      `${run.workflow ?? ""} ${run.agentType} ${run.task}`.toLowerCase();
    return (
      haystack.includes("draft") ||
      run.status === "WAITING_FOR_APPROVAL" ||
      run.agentType === "DRAFTING"
    );
  });

  return (
    <div className="space-y-6" data-tour="matter-drafts">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">
            {t.draftsTitle}
          </h2>
          <p className="mt-1 text-sm text-stone-600">{t.draftsSubtitle}</p>
        </div>
        <Link
          href={`/app/matters/${matterId}/ai?task=${encodeURIComponent("Draft a response letter addressing the key issues in this matter.")}`}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {t.newDraft}
        </Link>
      </div>

      {drafts.length ? (
        <ul className="space-y-2">
          {drafts.map((run) => (
            <li key={run.runId}>
              <Link
                href={`/app/matters/${matterId}/drafts/${run.runId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[var(--panel)] px-5 py-4 hover:border-stone-300"
              >
                <div>
                  <p className="line-clamp-1 font-medium text-stone-900">
                    {run.task}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {t.lastEdited}{" "}
                    {new Date(run.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <StatusBadge
                  label={aiStatusLabel(run.status, t)}
                  tone={aiStatusTone(run.status)}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={t.noDraftsTitle}
          description={t.noDraftsBody}
          actionLabel={t.createDraft}
          actionHref={`/app/matters/${matterId}/ai?task=${encodeURIComponent("Draft a response letter addressing the key issues in this matter.")}`}
        />
      )}
    </div>
  );
}
