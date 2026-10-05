import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CreateMatterForm } from "@/components/workspaces/create-matter-form";
import { RenameWorkspaceForm } from "@/components/workspaces/rename-workspace-form";
import { matterStatusLabel } from "@/components/workbench/labels";
import { requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { listMattersForUser } from "@/modules/matters/service";
import { MATTER_TYPE_LABELS } from "@/modules/matters/types";
import {
  getWorkspaceForUser,
  listWorkspaceMembers,
} from "@/modules/workspaces/service";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { t } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  let workspace;
  try {
    workspace = await getWorkspaceForUser({ workspaceId, context });
  } catch {
    redirect("/app");
  }

  const [matters, members] = await Promise.all([
    listMattersForUser({ workspaceId, context }),
    listWorkspaceMembers({ workspaceId, context }),
  ]);

  const canManage =
    workspace.role === "OWNER" || workspace.role === "LAWYER";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 lg:py-10">
      <Link
        href="/app/settings"
        className="text-sm text-stone-600 hover:text-stone-900"
      >
        ← {t.backToSettings}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-stone-500">
            {t.workspace}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            {workspace.name}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {workspace.matterCount}{" "}
            {workspace.matterCount === 1 ? t.matterCount : t.mattersCount}
          </p>
        </div>
      </div>

      {canManage ? (
        <section className="mt-6 rounded-xl border border-stone-200 bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="text-lg font-medium text-stone-900">
            {t.workspaceSettings}
          </h2>
          <div className="mt-4">
            <RenameWorkspaceForm
              workspaceId={workspace.id}
              initialName={workspace.name}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-stone-200 bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-stone-900">{t.matters}</h2>
            <p className="mt-1 text-sm text-stone-600">{t.mattersSubtitle}</p>
          </div>
        </div>

        {matters.length ? (
          <ul className="mt-4 space-y-2">
            {matters.map((matter) => (
              <li key={matter.id}>
                <Link
                  href={`/app/matters/${matter.id}`}
                  className="block rounded-md border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50"
                >
                  <p className="font-medium text-stone-900">{matter.title}</p>
                  <p className="text-xs text-stone-500">
                    {MATTER_TYPE_LABELS[matter.matterType]} ·{" "}
                    {matterStatusLabel(matter.status, t)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-600">{t.noMattersTitle}</p>
        )}

        {canManage ? (
          <div className="mt-6 border-t border-stone-200 pt-6">
            <h3 className="text-sm font-medium text-stone-900">{t.newMatter}</h3>
            <div className="mt-3 max-w-lg">
              <CreateMatterForm workspaceId={workspace.id} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-[var(--panel)] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-stone-900">{t.participants}</h2>
        <p className="mt-1 text-sm text-stone-600">{t.workspacesBody}</p>
        <ul className="mt-4 space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="rounded-md border border-stone-200 bg-white px-4 py-3"
            >
              <p className="font-medium text-stone-900">
                {member.firstName} {member.lastName}
              </p>
              <p className="text-xs text-stone-500">
                {member.email} · {member.role}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
