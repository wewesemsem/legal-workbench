"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MATTER_TYPE_LABELS,
  MATTER_TYPES,
} from "@/modules/matters/types";

export function CreateMatterForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/matters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          matterType: String(form.get("matterType") ?? "OTHER"),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Unable to create matter");
      }
      router.push(`/app/matters/${data.matter.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create matter");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">Matter title</span>
        <input
          name="title"
          required
          placeholder="Smith v. Jones"
          className="auth-input"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">Matter type</span>
        <select name="matterType" defaultValue="OTHER" className="auth-input">
          {MATTER_TYPES.map((type) => (
            <option key={type} value={type}>
              {MATTER_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">
          Description (optional)
        </span>
        <textarea
          name="description"
          rows={3}
          className="auth-input"
          placeholder="Brief matter notes"
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
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create matter"}
      </button>
    </form>
  );
}
