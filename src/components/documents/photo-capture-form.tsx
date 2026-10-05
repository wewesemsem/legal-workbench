"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/modules/i18n/provider";

type PhotoPage = {
  id: string;
  file: File;
  previewUrl: string;
};

type PhotoCaptureFormProps = {
  matterId: string;
};

export function PhotoCaptureForm({ matterId }: PhotoCaptureFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const retakeInputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PhotoPage[]>([]);
  const [retakeId, setRetakeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = pages.length > 0 && !pending;

  const pageCountLabel = useMemo(
    () => `${pages.length} ${t.pages}`,
    [pages.length, t.pages],
  );

  function revokeAll(next: PhotoPage[]) {
    for (const page of next) {
      URL.revokeObjectURL(page.previewUrl);
    }
  }

  function cancelCapture() {
    revokeAll(pages);
    setPages([]);
    setTitle("");
    setError(null);
    setStatus(null);
    setRetakeId(null);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }
    const additions: PhotoPage[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) {
        setError(t.imagesOnlyPages);
        continue;
      }
      additions.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (additions.length) {
      setPages((current) => [...current, ...additions]);
      setError(null);
    }
  }

  function removePage(id: string) {
    setPages((current) => {
      const target = current.find((page) => page.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((page) => page.id !== id);
    });
  }

  function movePage(id: string, direction: -1 | 1) {
    setPages((current) => {
      const index = current.findIndex((page) => page.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item!);
      return copy;
    });
  }

  function startRetake(id: string) {
    setRetakeId(id);
    retakeInputRef.current?.click();
  }

  function onRetakeFiles(fileList: FileList | null) {
    if (!retakeId || !fileList?.[0]) {
      setRetakeId(null);
      return;
    }
    const file = fileList[0];
    if (!file.type.startsWith("image/")) {
      setError(t.imagesOnlyRetake);
      setRetakeId(null);
      return;
    }

    setPages((current) =>
      current.map((page) => {
        if (page.id !== retakeId) {
          return page;
        }
        URL.revokeObjectURL(page.previewUrl);
        return {
          id: page.id,
          file,
          previewUrl: URL.createObjectURL(file),
        };
      }),
    );
    setRetakeId(null);
    setError(null);
  }

  async function onSubmit() {
    if (!pages.length) {
      setError(t.addAtLeastOnePage);
      return;
    }

    setPending(true);
    setError(null);
    setStatus(t.uploadingPages);

    try {
      const form = new FormData();
      if (title.trim()) {
        form.set("title", title.trim());
      }
      for (const page of pages) {
        form.append("pages", page.file, page.file.name);
      }

      setStatus(t.processingDocument);
      const response = await fetch(
        `/api/matters/${matterId}/documents/photos`,
        {
          method: "POST",
          body: form,
          credentials: "include",
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? t.uploadFailed);
      }

      setStatus(
        data.document?.processingStatus === "FAILED"
          ? t.uploadedProcessingFailed
          : t.documentReady,
      );
      revokeAll(pages);
      setPages([]);
      setTitle("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.uploadFailed);
      setStatus(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={retakeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          onRetakeFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">
          {t.documentTitleOptional}
        </span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t.courtFilingPhotos}
          className="auth-input"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">
          {t.takeSelectPhotos}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
          className="auth-input"
        />
      </label>

      <p className="text-sm text-stone-600">
        {pageCountLabel} {t.pagesReady}
      </p>

      {pages.length ? (
        <ul className="space-y-3">
          {pages.map((page, index) => (
            <li
              key={page.id}
              className="flex items-center gap-3 rounded-md border border-stone-200 bg-white p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.previewUrl}
                alt={`${t.pageLabel} ${index + 1}`}
                className="h-20 w-16 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-900">
                  {t.pageLabel} {index + 1}
                </p>
                <p className="truncate text-xs text-stone-500">
                  {page.file.name}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => movePage(page.id, -1)}
                  className="rounded border border-stone-300 px-2 py-1 text-xs"
                >
                  {t.up}
                </button>
                <button
                  type="button"
                  onClick={() => movePage(page.id, 1)}
                  className="rounded border border-stone-300 px-2 py-1 text-xs"
                >
                  {t.down}
                </button>
                <button
                  type="button"
                  onClick={() => startRetake(page.id)}
                  className="rounded border border-stone-300 px-2 py-1 text-xs"
                >
                  {t.retake}
                </button>
                <button
                  type="button"
                  onClick={() => removePage(page.id)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                >
                  {t.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {status ? <p className="text-sm text-stone-600">{status}</p> : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pending ? t.statusProcessing : t.confirmProcessDocument}
        </button>
        {pages.length || title ? (
          <button
            type="button"
            disabled={pending}
            onClick={cancelCapture}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
          >
            {t.cancel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
