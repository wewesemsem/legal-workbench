"use client";

import { FormEvent, useMemo, useState } from "react";

type MemoryItem = {
  id: string;
  key: string;
  value: string;
  type: string;
  source_type: string;
  confidence: number;
  status: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
};

type MemoryConflict = {
  id: string;
  existing_memory_id: string;
  proposed_key: string;
  proposed_value: string;
  proposed_source_type: string;
  status: string;
};

function sourceLabel(source: string) {
  switch (source) {
    case "LAWYER_CONFIRMED":
      return "Lawyer confirmed";
    case "USER_PROVIDED":
      return "User provided";
    case "DOCUMENT_DERIVED":
      return "Document derived";
    case "CONVERSATION_DERIVED":
      return "Conversation derived";
    case "AI_DERIVED":
      return "AI derived";
    case "SYSTEM_DEFINED":
      return "System defined";
    default:
      return source;
  }
}

export function MatterMemoryPanel({
  matterId,
  canManage,
  initialMemories,
  initialConflicts,
}: {
  matterId: string;
  canManage: boolean;
  initialMemories: MemoryItem[];
  initialConflicts: MemoryConflict[];
}) {
  const [memories, setMemories] = useState(initialMemories);
  const [conflicts, setConflicts] = useState(initialConflicts);
  const [key, setKey] = useState("client");
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q),
    );
  }, [memories, query]);

  async function reload() {
    const response = await fetch(
      `/api/matters/${matterId}/memory?include_pending=1`,
      { credentials: "include" },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load memory");
    }
    setMemories(data.memories ?? []);
    setConflicts(data.conflicts ?? []);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/memory`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          value,
          source_type: "USER_PROVIDED",
          require_confirmation: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.reason ?? data?.error?.message ?? "Create failed");
      }
      if (data.status === "CONFLICT_DETECTED") {
        setError(
          `Conflict detected for ${data.conflict.proposed_key}. Resolve below.`,
        );
      }
      setValue("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(memoryId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/memory/${memoryId}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Confirm failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive(memoryId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/memory/${memoryId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Archive failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(memoryId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/memory/${memoryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Delete failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(memoryId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/memory/${memoryId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: editValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Update failed");
      }
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(
    conflictId: string,
    resolution: "KEEP_EXISTING" | "USE_PROPOSED",
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/memory/conflicts/${conflictId}/resolve`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resolution }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Resolve failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-stone-600">
        Matter Memory is contextual case information. It is not legal authority
        and never substitutes for the legal corpus or matter documents.
      </p>

      <label className="block text-sm">
        <span className="font-medium text-stone-900">Search</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          placeholder="Filter by key or value"
        />
      </label>

      {canManage ? (
        <form onSubmit={onCreate} className="space-y-2 rounded-md border border-stone-200 bg-white p-4">
          <p className="text-sm font-medium text-stone-900">Add matter fact</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm"
              placeholder="key (e.g. client)"
              required
            />
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm"
              placeholder="value"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-60"
          >
            Save
          </button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {conflicts.length ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Memory conflicts</p>
          <ul className="mt-3 space-y-3">
            {conflicts.map((conflict) => (
              <li key={conflict.id} className="text-sm text-stone-800">
                <p>
                  <span className="font-medium">{conflict.proposed_key}</span>
                  {" → proposed "}
                  <span className="font-medium">{conflict.proposed_value}</span>
                  {" ("}
                  {sourceLabel(conflict.proposed_source_type)}
                  {")"}
                </p>
                {canManage ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resolveConflict(conflict.id, "KEEP_EXISTING")
                      }
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
                    >
                      Keep existing
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resolveConflict(conflict.id, "USE_PROPOSED")
                      }
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
                    >
                      Use proposed
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="space-y-3">
        {filtered.map((item) => (
          <li
            key={item.id}
            className="rounded-md border border-stone-200 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-stone-900">{item.key}</p>
                {editingId === item.id ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      className="min-w-[12rem] flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveEdit(item.id)}
                      className="rounded-md bg-stone-900 px-2 py-1 text-xs text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-stone-300 px-2 py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-stone-700">{item.value}</p>
                )}
                <p className="mt-2 text-xs text-stone-500">
                  {sourceLabel(item.source_type)} · conf {item.confidence} ·{" "}
                  {item.status}
                </p>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {item.status === "PENDING_CONFIRMATION" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirm(item.id)}
                      className="rounded-md bg-stone-900 px-2 py-1 text-xs text-white"
                    >
                      Confirm
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(item.id);
                      setEditValue(item.value);
                    }}
                    className="rounded-md border border-stone-300 px-2 py-1 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => archive(item.id)}
                    className="rounded-md border border-stone-300 px-2 py-1 text-xs"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(item.id)}
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!filtered.length ? (
        <p className="text-sm text-stone-600">No matter memory yet.</p>
      ) : null}
    </div>
  );
}
