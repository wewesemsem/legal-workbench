import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { RetryDocumentButton } from "@/components/documents/retry-button";
import { documentStatusLabel } from "@/components/workbench/labels";
import {
  StatusBadge,
  documentStatusTone,
} from "@/components/workbench/status-badge";
import { requireAuthContext } from "@/modules/auth/service";
import { getMatterDocument } from "@/modules/documents/service";
import { getRequestI18n } from "@/modules/i18n/server";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ matterId: string; documentId: string }>;
}) {
  const { matterId, documentId } = await params;
  const { t } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  const { document, pages, access } = await getMatterDocument({
    documentId,
    context,
    includeExtractedText: true,
  });

  if (document.matterId !== matterId) {
    redirect(`/app/matters/${document.matterId}/documents/${documentId}`);
  }

  const canManage = access.memberRole === "LAWYER";
  const askHref = `/app/matters/${matterId}/ai?task=${encodeURIComponent(
    `Review ${document.originalFilename} against Egyptian law and identify anything I should be concerned about.`,
  )}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/app/matters/${matterId}/documents`}
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            ← {t.backToDocuments}
          </Link>
          <h2 className="mt-3 text-2xl font-semibold text-stone-900">
            {document.originalFilename}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={documentStatusLabel(document.processingStatus, t)}
              tone={documentStatusTone(document.processingStatus)}
            />
            <span className="text-sm text-stone-500">
              {document.pageCount
                ? `${document.pageCount} ${t.pages}`
                : t.pagesPending}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={askHref}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t.askAboutDocument}
          </Link>
          {document.processingStatus === "FAILED" ||
          document.processingStatus === "UPLOADED" ? (
            <RetryDocumentButton documentId={document.id} />
          ) : null}
          {canManage ? (
            <DeleteDocumentButton
              documentId={document.id}
              redirectTo={`/app/matters/${matterId}/documents`}
            />
          ) : null}
        </div>
      </div>

      {document.processingError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {document.processingError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-5">
          <h3 className="text-lg font-medium text-stone-900">{t.document}</h3>
          <p className="mt-1 text-sm text-stone-600">{t.citationsOpenPage}</p>
          <div className="mt-4 overflow-hidden rounded-md border border-stone-200 bg-white">
            {document.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/documents/${document.id}/original`}
                alt={document.originalFilename}
                className="max-h-[70vh] w-full object-contain"
              />
            ) : document.mimeType === "application/pdf" ? (
              <iframe
                title={document.originalFilename}
                src={`/api/documents/${document.id}/original`}
                className="h-[70vh] w-full"
              />
            ) : (
              <div className="p-4 text-sm text-stone-600">
                {t.previewUnavailable}{" "}
                <a
                  href={`/api/documents/${document.id}/original`}
                  className="underline"
                >
                  {t.downloadOriginal}
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-5">
          <h3 className="text-lg font-medium text-stone-900">{t.ai}</h3>
          <p className="mt-1 text-sm text-stone-600">{t.extractedTextHint}</p>
          <Link
            href={askHref}
            className="mt-3 inline-flex rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            {t.askAboutDocument}
          </Link>

          {pages.length ? (
            <div className="mt-4 space-y-4">
              {pages.map((page) => (
                <article
                  key={page.id}
                  id={`page-${page.pageNumber}`}
                  className="rounded-md border border-stone-200 bg-white p-4"
                >
                  <h4 className="text-sm font-semibold text-stone-900">
                    {t.pageLabel} {page.pageNumber}
                  </h4>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-stone-700">
                    {page.extractedText || t.noTextExtracted}
                  </pre>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-600">
              {document.processingStatus === "PROCESSING"
                ? t.extractingText
                : document.extractedText || t.noExtractedText}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
