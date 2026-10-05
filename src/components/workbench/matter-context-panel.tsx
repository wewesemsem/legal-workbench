"use client";

import { FormEvent, useMemo, useState } from "react";

import { provenanceLabel } from "@/components/workbench/labels";
import { StatusBadge } from "@/components/workbench/status-badge";
import { useI18n } from "@/modules/i18n/provider";

export type ContextMemoryItem = {
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

export type ContextConflict = {
  id: string;
  existing_memory_id: string;
  proposed_key: string;
  proposed_value: string;
  proposed_source_type: string;
  status: string;
};

function prettyKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function MatterContextPanel({
  matterId,
  canManage,
  initialMemories,
  initialConflicts,
  counts,
  compact = false,
}: {
  matterId: string;
  canManage: boolean;
  initialMemories: ContextMemoryItem[];
  initialConflicts: ContextConflict[];
  counts: {
    documents: number;
    research: number;
    drafts: number;
    memory: number;
  };
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [memories, setMemories] = useState(initialMemories);
  const [conflicts, setConflicts] = useState(initialConflicts);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    facts: true,
    preferences: true,
    pending: true,
  });
  const [label, setLabel] = useState("client");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const pending = useMemo(
    () => memories.filter((item) => item.status === "PENDING_CONFIRMATION"),
    [memories],
  );
  const active = useMemo(
    () => memories.filter((item) => item.status === "ACTIVE"),
    [memories],
  );
  const preferences = active.filter((item) =>
    /prefer|style|language|tone/i.test(item.key),
  );
  const facts = active.filter((item) => !preferences.includes(item));
  const clientFact = facts.find((item) =>
    ["client", "client_name", "client name"].includes(item.key.toLowerCase()),
  );

  async function reload() {
    const response = await fetch(
      `/api/matters/${matterId}/memory?include_pending=1`,
      { credentials: "include" },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load matter context");
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
          key: label,
          value,
          source_type: "USER_PROVIDED",
          require_confirmation: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.reason ?? data?.error?.message ?? "Save failed");
      }
      setValue("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
        throw new Error(data?.error?.message ?? "Remove failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
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

  function toggle(section: string) {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  return (
    <aside
      data-tour="matter-context"
      className={`rounded-xl border border-stone-200 bg-[var(--panel)] ${
        compact ? "p-4" : "p-5"
      }`}
      aria-label="Matter context"
    >
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-500">
          {t.matterContext}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{t.matterContextBody}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
          <dt className="text-stone-500">{t.documents}</dt>
          <dd className="mt-0.5 text-base font-medium text-stone-900">
            {counts.documents}
          </dd>
        </div>
        <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
          <dt className="text-stone-500">{t.research}</dt>
          <dd className="mt-0.5 text-base font-medium text-stone-900">
            {counts.research}
          </dd>
        </div>
        <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
          <dt className="text-stone-500">{t.drafts}</dt>
          <dd className="mt-0.5 text-base font-medium text-stone-900">
            {counts.drafts}
          </dd>
        </div>
        <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
          <dt className="text-stone-500">{t.keyFacts}</dt>
          <dd className="mt-0.5 text-base font-medium text-stone-900">
            {counts.memory}
          </dd>
        </div>
      </dl>

      {clientFact ? (
        <div className="mt-4 rounded-md border border-stone-200 bg-white px-3 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-stone-500">
            {t.clientLabel}
          </p>
          <p className="mt-1 text-sm font-medium text-stone-900">
            {clientFact.value}
          </p>
          <div className="mt-2">
            <StatusBadge
              label={provenanceLabel(clientFact.source_type, t)}
              tone="success"
            />
          </div>
        </div>
      ) : null}

      {pending.length ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left text-sm font-medium text-amber-950"
            onClick={() => toggle("pending")}
          >
            {t.suggestedUpdates}
            <span>{openSections.pending ? "−" : "+"}</span>
          </button>
          {openSections.pending ? (
            <ul className="mt-3 space-y-3">
              {pending.map((item) => (
                <li key={item.id} className="text-sm text-stone-800">
                  <p className="font-medium">{prettyKey(item.key)}</p>
                  <p className="mt-1">{item.value}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {provenanceLabel(item.source_type, t)}
                  </p>
                  {canManage ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirm(item.id)}
                        className="rounded-md bg-stone-900 px-2 py-1 text-xs text-white disabled:opacity-60"
                      >
                        {t.save}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => archive(item.id)}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs disabled:opacity-60"
                      >
                        {t.dontSave}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {conflicts.length ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-950">
            {t.contextNeedsDecision}
          </p>
          <ul className="mt-3 space-y-3">
            {conflicts.map((conflict) => (
              <li key={conflict.id} className="text-sm text-stone-800">
                <p>
                  <span className="font-medium">
                    {prettyKey(conflict.proposed_key)}
                  </span>
                  {": "}
                  {conflict.proposed_value}
                </p>
                {canManage ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resolveConflict(conflict.id, "KEEP_EXISTING")
                      }
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
                    >
                      {t.keepExisting}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resolveConflict(conflict.id, "USE_PROPOSED")
                      }
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
                    >
                      {t.useProposed}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="mt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-medium text-stone-900"
          onClick={() => toggle("facts")}
        >
          {t.keyFacts}
          <span className="text-stone-400">{openSections.facts ? "−" : "+"}</span>
        </button>
        {openSections.facts ? (
          <ul className="mt-2 space-y-2">
            {facts.length ? (
              facts.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-stone-200 bg-white px-3 py-2"
                >
                  <p className="text-xs uppercase tracking-[0.1em] text-stone-500">
                    {prettyKey(item.key)}
                  </p>
                  {editingId === item.id ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        className="min-w-[10rem] flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveEdit(item.id)}
                        className="rounded-md bg-stone-900 px-2 py-1 text-xs text-white"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-stone-800">{item.value}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge label={provenanceLabel(item.source_type, t)} />
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="text-xs text-stone-600 underline"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditValue(item.value);
                          }}
                        >
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-stone-600 underline"
                          onClick={() => archive(item.id)}
                        >
                          {t.remove}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-stone-500">{t.noKeyFacts}</li>
            )}
          </ul>
        ) : null}
      </section>

      <section className="mt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-medium text-stone-900"
          onClick={() => toggle("preferences")}
        >
          {t.preferences}
          <span className="text-stone-400">
            {openSections.preferences ? "−" : "+"}
          </span>
        </button>
        {openSections.preferences ? (
          <ul className="mt-2 space-y-2">
            {preferences.length ? (
              preferences.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                >
                  <p className="font-medium text-stone-900">
                    {prettyKey(item.key)}
                  </p>
                  <p className="mt-1 text-stone-700">{item.value}</p>
                </li>
              ))
            ) : (
              <li className="text-sm text-stone-500">{t.noPreferences}</li>
            )}
          </ul>
        ) : null}
      </section>

      {canManage ? (
        <form
          onSubmit={onCreate}
          className="mt-5 space-y-2 border-t border-stone-200 pt-4"
        >
          <p className="text-sm font-medium text-stone-900">{t.addToContext}</p>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            placeholder={t.label}
            required
          />
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            placeholder={t.value}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {t.save}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </aside>
  );
}
