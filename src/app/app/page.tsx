import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/workbench/empty-state";
import { StatusBadge } from "@/components/workbench/status-badge";
import { matterStatusLabel } from "@/components/workbench/labels";
import { requireAuthContext, getSessionUser } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { MATTER_TYPE_LABELS } from "@/modules/matters/types";
import {
  ensureDefaultWorkspace,
  listWorkspacesForUser,
} from "@/modules/workspaces/service";
import {
  listPendingApprovalsAcrossMatters,
  listWorkbenchMatters,
} from "@/modules/workbench/queries";

export default async function AppHomePage() {
  const { t } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });
  const user = await getSessionUser(request);
  if (!user) redirect("/login");

  const context = await requireAuthContext(request);
  let workspaces = await listWorkspacesForUser(context);
  if (!workspaces.length && context.role === "LAWYER") {
    await ensureDefaultWorkspace(context);
    workspaces = await listWorkspacesForUser(context);
  }

  const [matters, pendingApprovals] = await Promise.all([
    listWorkbenchMatters(context),
    listPendingApprovalsAcrossMatters(context),
  ]);

  const recentMatters = matters.slice(0, 6);
  const primaryWorkspace = workspaces[0];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-stone-500">
            {t.brand}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            {t.welcome}, {user.firstName}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
            {t.homeSubtitle}
          </p>
        </div>
        {primaryWorkspace && context.role === "LAWYER" ? (
          <Link
            href={`/app/workspaces/${primaryWorkspace.id}`}
            data-tour="new-matter"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t.newMatter}
          </Link>
        ) : null}
      </div>

      {pendingApprovals.length ? (
        <section className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-base font-medium text-amber-950">
            {t.needsAttention}
          </h2>
          <ul className="mt-3 space-y-2">
            {pendingApprovals.slice(0, 5).map((approval) => (
              <li key={approval.id}>
                <Link
                  href={`/app/matters/${approval.matterId}/ai`}
                  className="block rounded-md border border-amber-200 bg-white px-4 py-3 text-sm hover:bg-amber-50/60"
                >
                  <span className="font-medium text-stone-900">
                    {approval.matterTitle}
                  </span>
                  <span className="mt-1 block text-stone-600">
                    {approval.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8" data-tour="recent-matters">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-stone-900">
            {t.recentMatters}
          </h2>
          <Link
            href="/app/matters"
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            {t.viewAll}
          </Link>
        </div>

        {recentMatters.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {recentMatters.map((matter) => (
              <li
                key={matter.id}
                className="rounded-xl border border-stone-200 bg-[var(--panel)] px-5 py-4 transition hover:border-stone-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/app/matters/${matter.id}`}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      {matter.title}
                    </Link>
                    <p className="mt-1 text-xs text-stone-500">
                      {matter.workspaceName} ·{" "}
                      {MATTER_TYPE_LABELS[matter.matterType]}
                    </p>
                  </div>
                  <StatusBadge label={matterStatusLabel(matter.status, t)} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/app/matters/${matter.id}/ai`}
                    className="rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800"
                  >
                    {t.askAi}
                  </Link>
                  <Link
                    href={`/app/matters/${matter.id}`}
                    className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50"
                  >
                    {t.openMatter}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              title={t.noMattersTitle}
              description={t.noMattersBody}
              actionLabel={t.createMatter}
              actionHref={
                primaryWorkspace
                  ? `/app/workspaces/${primaryWorkspace.id}`
                  : "/app/settings"
              }
            />
          </div>
        )}
      </section>

      <section
        className="mt-8 grid gap-3 sm:grid-cols-3"
        data-tour="home-shortcuts"
      >
        <Link
          href="/app/documents"
          className="rounded-xl border border-stone-200 bg-[var(--panel)] px-4 py-4 text-sm hover:border-stone-300"
        >
          <p className="font-medium text-stone-900">{t.documents}</p>
          <p className="mt-1 text-stone-600">{t.documentsCardBody}</p>
        </Link>
        <Link
          href="/app/legal"
          className="rounded-xl border border-stone-200 bg-[var(--panel)] px-4 py-4 text-sm hover:border-stone-300"
        >
          <p className="font-medium text-stone-900">{t.publicLawResearch}</p>
          <p className="mt-1 text-stone-600">{t.publicLawResearchBody}</p>
        </Link>
        <Link
          href="/app/settings"
          className="rounded-xl border border-stone-200 bg-[var(--panel)] px-4 py-4 text-sm hover:border-stone-300"
        >
          <p className="font-medium text-stone-900">{t.settings}</p>
          <p className="mt-1 text-stone-600">{t.settingsCardBody}</p>
        </Link>
      </section>
    </main>
  );
}
