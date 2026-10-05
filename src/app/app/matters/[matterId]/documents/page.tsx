import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { PhotoCaptureForm } from "@/components/documents/photo-capture-form";
import { DocumentList } from "@/components/workbench/document-list";
import { requireAuthContext } from "@/modules/auth/service";
import { listMatterDocuments } from "@/modules/documents/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { getMatterForUser } from "@/modules/matters/service";

export default async function MatterDocumentsPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const { matterId } = await params;
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

  const documents = await listMatterDocuments({ matterId, context });
  const canManage = matter.memberRole === "LAWYER";

  return (
    <div className="space-y-6" data-tour="matter-documents">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">
          {t.documentsTitle}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{t.noDocumentsBody}</p>
      </div>

      <DocumentList
        matterId={matterId}
        canManage={canManage}
        documents={documents.map((document) => ({
          id: document.id,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          createdAt: document.createdAt,
          pageCount: document.pageCount,
          processingStatus: document.processingStatus,
          processingError: document.processingError,
        }))}
      />

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-5">
            <h3 className="text-sm font-medium text-stone-900">{t.upload}</h3>
            <p className="mt-1 text-sm text-stone-600">{t.uploadHint}</p>
            <div className="mt-3">
              <DocumentUploadForm matterId={matterId} />
            </div>
          </section>
          <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-5">
            <h3 className="text-sm font-medium text-stone-900">{t.takePhotos}</h3>
            <p className="mt-1 text-sm text-stone-600">{t.takePhotosHint}</p>
            <div className="mt-3">
              <PhotoCaptureForm matterId={matterId} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
