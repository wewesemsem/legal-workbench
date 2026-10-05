import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { CreateWorkspaceForm } from "@/components/workspaces/create-workspace-form";
import { roleLabel } from "@/components/workbench/labels";
import { WorkbenchTourButton } from "@/components/workbench/workbench-tour";
import { getSessionUser, requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import {
  ensureDefaultWorkspace,
  listWorkspacesForUser,
} from "@/modules/workspaces/service";

export default async function SettingsPage() {
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 lg:py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
        {t.settingsTitle}
      </h1>
      <p className="mt-2 text-sm text-stone-600">{t.settingsSubtitle}</p>

      <section className="mt-8 rounded-xl border border-stone-200 bg-[var(--panel)] p-6">
        <h2 className="text-lg font-medium text-stone-900">{t.account}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">{t.name}</dt>
            <dd className="font-medium text-stone-900">
              {user.firstName} {user.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">{t.email}</dt>
            <dd className="font-medium text-stone-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-stone-500">{t.role}</dt>
            <dd className="font-medium text-stone-900">
              {roleLabel(user.role, t)}
            </dd>
          </div>
        </dl>
        <div className="mt-6 max-w-md">
          <ChangePasswordForm />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-[var(--panel)] p-6">
        <h2 className="text-lg font-medium text-stone-900">{t.tourRestart}</h2>
        <p className="mt-1 text-sm text-stone-600">{t.tourRestartHint}</p>
        <div className="mt-4">
          <WorkbenchTourButton variant="panel" />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-[var(--panel)] p-6">
        <h2 className="text-lg font-medium text-stone-900">{t.workspaces}</h2>
        <p className="mt-1 text-sm text-stone-600">{t.workspacesBody}</p>
        {workspaces.length ? (
          <ul className="mt-4 space-y-2">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  href={`/app/workspaces/${workspace.id}`}
                  className="block rounded-md border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50"
                >
                  <p className="font-medium text-stone-900">{workspace.name}</p>
                  <p className="text-xs text-stone-500">
                    {workspace.matterCount}{" "}
                    {workspace.matterCount === 1
                      ? t.matterCount
                      : t.mattersCount}{" "}
                    · {roleLabel(workspace.role, t)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-600">{t.noWorkspaces}</p>
        )}

        {context.role === "LAWYER" ? (
          <div className="mt-6 border-t border-stone-200 pt-6">
            <h3 className="text-sm font-medium text-stone-900">
              {t.createWorkspace}
            </h3>
            <div className="mt-3 max-w-lg">
              <CreateWorkspaceForm />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
