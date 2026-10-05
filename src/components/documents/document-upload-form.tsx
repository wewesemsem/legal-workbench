"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/modules/i18n/provider";

type DocumentUploadFormProps = {
  matterId: string;
};

export function DocumentUploadForm({ matterId }: DocumentUploadFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    setStatus(t.uploading);

    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError(t.choosePdfOrImage);
      setPending(false);
      setStatus(null);
      return;
    }

    try {
      setStatus(t.processingDocument);
      const response = await fetch(`/api/matters/${matterId}/documents`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? t.uploadFailed);
      }
      setStatus(
        data.document?.processingStatus === "FAILED"
          ? t.uploadedProcessingFailed
          : t.documentReady,
      );
      event.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.uploadFailed);
      setStatus(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">
          {t.uploadPdfOrImage}
        </span>
        <input
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
          required
          className="auth-input"
        />
      </label>
      {status ? (
        <p className="text-sm text-stone-600">{status}</p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pending ? t.working : t.uploadDocument}
      </button>
    </form>
  );
}
