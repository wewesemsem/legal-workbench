"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MATTER_STATUSES,
  MATTER_TYPE_LABELS,
  MATTER_TYPES,
  type MatterStatus,
  type MatterType,
} from "@/modules/matters/types";

export function UpdateMatterForm({
  matterId,
  initialTitle,
  initialDescription,
  initialStatus,
  initialMatterType,
}: {
  matterId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialStatus: MatterStatus;
  initialMatterType: MatterType;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          status: String(form.get("status") ?? "OPEN"),
          matterType: String(form.get("matterType") ?? "OTHER"),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Unable to update matter");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update matter");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">Title</span>
        <input
          name="title"
          required
          defaultValue={initialTitle}
          className="auth-input"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-stone-700">Type</span>
          <select
            name="matterType"
            defaultValue={initialMatterType}
            className="auth-input"
          >
            {MATTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {MATTER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-stone-700">Status</span>
          <select
            name="status"
            defaultValue={initialStatus}
            className="auth-input"
          >
            {MATTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">Description</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={initialDescription ?? ""}
          className="auth-input"
        />
      </label>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
