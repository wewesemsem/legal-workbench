"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function RenameWorkspaceForm({
  workspaceId,
  initialName,
}: {
  workspaceId: string;
  initialName: string;
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
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Unable to update workspace");
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update workspace",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="min-w-[220px] flex-1 space-y-1.5">
        <span className="text-sm font-medium text-stone-700">
          Workspace name
        </span>
        <input
          name="name"
          required
          defaultValue={initialName}
          className="auth-input"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Rename"}
      </button>
      {error ? (
        <p className="w-full text-sm text-red-700">{error}</p>
      ) : null}
    </form>
  );
}
