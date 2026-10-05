"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Unable to create workspace");
      }
      router.push(`/app/workspaces/${data.workspace.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create workspace",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">
          Workspace name
        </span>
        <input
          name="name"
          required
          placeholder="My Law Practice"
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
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}
