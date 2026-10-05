import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/workbench/empty-state";
import {
  StatusBadge,
  documentStatusTone,
} from "@/components/workbench/status-badge";
import { documentStatusLabel } from "@/components/workbench/labels";
import { requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import {
  listWorkbenchDocuments,
  listWorkbenchMatters,
} from "@/modules/workbench/queries";

export default async function GlobalDocumentsPage() {
  const { t, locale } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  const [documents, matters] = await Promise.all([
    listWorkbenchDocuments(context),
    listWorkbenchMatters(context),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
        {t.documentsTitle}
      </h1>
      <p className="mt-2 text-sm text-stone-600">{t.documentsSubtitle}</p>

      {documents.length ? (
        <ul className="mt-8 space-y-2">
          {documents.map((document) => (
            <li key={document.id}>
              <Link
                href={`/app/matters/${document.matterId}/documents/${document.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[var(--panel)] px-5 py-4 hover:border-stone-300"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {document.originalFilename}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {document.matterTitle}
                    {document.pageCount
                      ? ` · ${document.pageCount} ${t.pages}`
                      : ""}{" "}
                    · {new Date(document.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
                <StatusBadge
                  label={documentStatusLabel(document.processingStatus, t)}
                  tone={documentStatusTone(document.processingStatus)}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState
            title={t.noDocumentsTitle}
            description={t.noDocumentsBody}
            actionLabel={matters[0] ? t.openAMatter : t.browseMatters}
            actionHref={
              matters[0]
                ? `/app/matters/${matters[0].id}/documents`
                : "/app/matters"
            }
          />
        </div>
      )}
    </main>
  );
}
