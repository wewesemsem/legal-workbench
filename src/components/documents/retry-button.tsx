"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/modules/i18n/provider";

export function RetryDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRetry() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? t.retryFailed);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.retryFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onRetry}
        disabled={pending}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
      >
        {pending ? t.retrying : t.retry}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
