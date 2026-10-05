import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/workbench/empty-state";
import { requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { listWorkbenchClients } from "@/modules/workbench/queries";
import { listWorkspacesForUser } from "@/modules/workspaces/service";

export default async function ClientsPage() {
  const { t } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  const [clients, workspaces] = await Promise.all([
    listWorkbenchClients(context),
    listWorkspacesForUser(context),
  ]);
  const primaryWorkspace = workspaces[0];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
        {t.clientsTitle}
      </h1>
      <p className="mt-2 text-sm text-stone-600">{t.clientsSubtitle}</p>

      {clients.length ? (
        <ul className="mt-8 space-y-2">
          {clients.map((client) => (
            <li
              key={client.name}
              className="rounded-xl border border-stone-200 bg-[var(--panel)] px-5 py-4"
            >
              <p className="font-medium text-stone-900">{client.name}</p>
              <p className="mt-1 text-xs text-stone-500">
                {client.matterIds.length}{" "}
                {client.matterIds.length === 1 ? t.matterCount : t.mattersCount}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {client.matterIds.map((matterId, index) => (
                  <li key={matterId}>
                    <Link
                      href={`/app/matters/${matterId}`}
                      className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-50"
                    >
                      {client.matterTitles[index]}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState
            title={t.noClientsTitle}
            description={t.noClientsBody}
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
