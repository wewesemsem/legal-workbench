"use client";

import { useState } from "react";

import { approvalActionLabel } from "@/components/workbench/labels";
import { useI18n } from "@/modules/i18n/provider";

export type PendingApproval = {
  id: string;
  action: string;
  risk_level: string;
  description: string;
  status: string;
  agent_run_id: string;
  proposed_output: Record<string, unknown>;
  requested_at: string;
};

function draftTextFromApproval(approval: PendingApproval | null | undefined) {
  const draft = approval?.proposed_output;
  if (approval?.action === "save_matter_memory" && draft) {
    return typeof draft.value === "string" ? draft.value : "";
  }
  if (draft && typeof draft.full_text === "string") {
    return draft.full_text;
  }
  return "";
}

export function ApprovalDialog({
  approval,
  matterTitle,
  canManage,
  onResolved,
}: {
  approval: PendingApproval | null;
  matterTitle: string;
  canManage: boolean;
  onResolved?: () => void;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editText, setEditText] = useState(() =>
    draftTextFromApproval(approval),
  );

  if (!approval) return null;

  const isMemory = approval.action === "save_matter_memory";

  async function decide(decision: "APPROVED" | "REJECTED" | "EDITED") {
    if (!approval) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { decision };
      if (decision === "EDITED") {
        if (isMemory) {
          body.edited_output = {
            ...(approval.proposed_output ?? {}),
            value: editText,
          };
        } else {
          body.edited_output = {
            ...(approval.proposed_output ?? {}),
            full_text: editText,
          };
        }
      }
      const response = await fetch(`/api/agents/approvals/${approval.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Approval failed");
      }
      onResolved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        className="w-full max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
          {t.approvalTitle}
        </p>
        <h2
          id="approval-title"
          className="mt-2 text-lg font-medium text-stone-900"
        >
          {isMemory ? t.approvalMemoryTitle : t.approvalDraftBody}
        </h2>
        <p className="mt-2 text-sm text-stone-700">
          {approvalActionLabel(approval.action, t)}
        </p>
        {approval.description &&
        (locale !== "ar" || /[\u0600-\u06FF]/.test(approval.description)) ? (
          <p className="mt-1 text-sm text-stone-600">{approval.description}</p>
        ) : null}
        <p className="mt-1 text-xs text-stone-500">
          {t.matters}: {matterTitle}
        </p>

        {isMemory ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-white p-3 text-sm">
            <p className="font-medium text-stone-900">
              {String(approval.proposed_output.key ?? t.keyFacts)}
            </p>
            <label className="mt-2 block text-sm text-stone-700">
              {t.value}
              <input
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <p className="mt-2 text-xs text-stone-500">{t.approvalInferred}</p>
          </div>
        ) : (
          <label className="mt-4 block text-sm font-medium text-stone-900">
            {t.proposedDraft}
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              rows={10}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        )}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !canManage}
            onClick={() => decide("APPROVED")}
            className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {isMemory ? t.save : t.approve}
          </button>
          <button
            type="button"
            disabled={busy || !canManage}
            onClick={() => decide("EDITED")}
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-60"
          >
            {t.edit}
          </button>
          <button
            type="button"
            disabled={busy || !canManage}
            onClick={() => decide("REJECTED")}
            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {isMemory ? t.dontSave : t.reject}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApprovalBanner({
  count,
  onReview,
}: {
  count: number;
  onReview: () => void;
}) {
  const { t } = useI18n();
  if (count <= 0) return null;
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
      role="status"
    >
      <div>
        <p className="text-sm font-medium text-amber-950">{t.approvalRequired}</p>
        <p className="text-sm text-amber-900">
          {count === 1
            ? t.oneItemNeedsReview
            : `${count} ${t.itemsNeedReview}`}
        </p>
      </div>
      <button
        type="button"
        onClick={onReview}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800"
      >
        {t.review}
      </button>
    </div>
  );
}
