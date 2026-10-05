"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { RetryDocumentButton } from "@/components/documents/retry-button";
import { documentStatusLabel } from "@/components/workbench/labels";
import {
  StatusBadge,
  documentStatusTone,
} from "@/components/workbench/status-badge";
import { EmptyState } from "@/components/workbench/empty-state";
import { useI18n } from "@/modules/i18n/provider";

export type DocumentListItem = {
  id: string;
  originalFilename: string;
  mimeType: string;
  createdAt: string | Date;
  pageCount: number | null;
  processingStatus: string;
  processingError: string | null;
};

export function DocumentList({
  matterId,
  documents,
  canManage,
}: {
  matterId: string;
  documents: DocumentListItem[];
  canManage: boolean;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((document) =>
      document.originalFilename.toLowerCase().includes(q),
    );
  }, [documents, query]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">{t.searchDocuments}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchDocuments}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        />
      </label>

      {filtered.length ? (
        <ul className="space-y-2">
          {filtered.map((document) => (
            <li
              key={document.id}
              className="rounded-xl border border-stone-200 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/app/matters/${matterId}/documents/${document.id}`}
                    className="font-medium text-stone-900 hover:underline"
                  >
                    {document.originalFilename}
                  </Link>
                  <p className="mt-1 text-xs text-stone-500">
                    {document.pageCount
                      ? `${document.pageCount} ${t.pages}`
                      : t.pagesPending}{" "}
                    · {new Date(document.createdAt).toLocaleDateString(locale)}
                  </p>
                  {document.processingError ? (
                    <p className="mt-1 text-sm text-red-700">
                      {document.processingError}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={documentStatusLabel(document.processingStatus, t)}
                    tone={documentStatusTone(document.processingStatus)}
                  />
                  {document.processingStatus === "FAILED" ||
                  document.processingStatus === "UPLOADED" ? (
                    <RetryDocumentButton documentId={document.id} />
                  ) : null}
                  {canManage ? (
                    <DeleteDocumentButton documentId={document.id} />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={t.noDocumentsTitle}
          description={t.noDocumentsBody}
        />
      )}
    </div>
  );
}
