import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/workbench/empty-state";
import { StatusBadge } from "@/components/workbench/status-badge";
import { matterStatusLabel } from "@/components/workbench/labels";
import { requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { MATTER_TYPE_LABELS } from "@/modules/matters/types";
import { listWorkspacesForUser } from "@/modules/workspaces/service";
import { listWorkbenchMatters } from "@/modules/workbench/queries";

export default async function MattersPage() {
  const { t, locale } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  const [matters, workspaces] = await Promise.all([
    listWorkbenchMatters(context),
    listWorkspacesForUser(context),
  ]);
  const primaryWorkspace = workspaces[0];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            {t.mattersTitle}
          </h1>
          <p className="mt-2 text-sm text-stone-600">{t.mattersSubtitle}</p>
        </div>
        {primaryWorkspace && context.role === "LAWYER" ? (
          <Link
            href={`/app/workspaces/${primaryWorkspace.id}`}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t.newMatter}
          </Link>
        ) : null}
      </div>

      {matters.length ? (
        <ul className="mt-8 space-y-2">
          {matters.map((matter) => (
            <li key={matter.id}>
              <Link
                href={`/app/matters/${matter.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[var(--panel)] px-5 py-4 hover:border-stone-300"
              >
                <div>
                  <p className="font-medium text-stone-900">{matter.title}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {matter.workspaceName} · {MATTER_TYPE_LABELS[matter.matterType]} ·{" "}
                    {t.updated}{" "}
                    {new Date(matter.updatedAt).toLocaleDateString(locale)}
                  </p>
                </div>
                <StatusBadge label={matterStatusLabel(matter.status, t)} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
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
    </main>
  );
}
