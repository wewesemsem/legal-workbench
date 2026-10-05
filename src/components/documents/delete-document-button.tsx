"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/modules/i18n/provider";

export function DeleteDocumentButton({
  documentId,
  redirectTo,
}: {
  documentId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!window.confirm(t.deleteDocumentConfirm)) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? t.deleteFailed);
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? t.deleting : t.delete}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
