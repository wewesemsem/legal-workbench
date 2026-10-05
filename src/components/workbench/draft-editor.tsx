"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AiActivity, type AiStep } from "@/components/workbench/ai-activity";
import {
  ApprovalDialog,
  type PendingApproval,
} from "@/components/workbench/approval-dialog";
import { useI18n } from "@/modules/i18n/provider";
import type { Messages } from "@/modules/i18n/messages";

function draftActions(t: Messages) {
  return [
    {
      label: t.improve,
      task: "Improve the writing quality of the current draft while preserving meaning.",
    },
    {
      label: t.makeConcise,
      task: "Make the current draft more concise.",
    },
    {
      label: t.moreFormal,
      task: "Rewrite the current draft in a more formal legal tone.",
    },
    {
      label: t.addCitations,
      task: "Add citations and legal support to the current draft where appropriate.",
    },
    {
      label: t.checkAgainstMatter,
      task: "Check the current draft against matter documents and context for consistency.",
    },
    {
      label: t.review,
      task: "Review the current draft for unsupported claims, missing citations, and legal risk.",
    },
  ] as const;
}

const ACTIVE_STATUSES = new Set(["PLANNING", "RUNNING"]);

export function DraftEditor({
  matterId,
  matterTitle,
  runId,
  canManage,
  initialText,
  initialApprovals,
}: {
  matterId: string;
  matterTitle: string;
  runId: string;
  canManage: boolean;
  initialText: string;
  initialApprovals: PendingApproval[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const actions = draftActions(t);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AiStep[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [showApproval, setShowApproval] = useState(initialApprovals.length > 0);

  useEffect(() => {
    if (!activeRunId || !status || !ACTIVE_STATUSES.has(status)) return;
    const runToPoll = activeRunId;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/agents/runs/${runToPoll}`, {
            credentials: "include",
          });
          const data = await response.json();
          if (!response.ok || cancelled) return;
          setStatus(data.status);
          setSteps(data.steps ?? []);
          setResult(
            data.result && typeof data.result === "object" ? data.result : null,
          );
          const draft = data.result?.draft;
          if (
            draft &&
            typeof draft === "object" &&
            typeof draft.full_text === "string"
          ) {
            setText(draft.full_text);
          }
          if (data.status === "WAITING_FOR_APPROVAL" && data.approval_id) {
            const approvalRes = await fetch(
              `/api/agents/approvals/${data.approval_id}`,
              { credentials: "include" },
            );
            const approval = await approvalRes.json();
            if (approvalRes.ok) {
              setApprovals([
                {
                  id: approval.id ?? data.approval_id,
                  action: approval.action,
                  risk_level:
                    approval.risk_level ?? approval.riskLevel ?? "HIGH",
                  description: approval.description,
                  status: approval.status,
                  agent_run_id:
                    approval.agent_run_id ??
                    approval.agentRunId ??
                    data.run_id,
                  proposed_output:
                    approval.proposed_output ?? approval.proposedOutput ?? {},
                  requested_at:
                    approval.requested_at ??
                    approval.requestedAt ??
                    new Date().toISOString(),
                },
              ]);
              setShowApproval(true);
            }
          }
          if (!ACTIVE_STATUSES.has(String(data.status))) {
            setBusy(false);
            router.refresh();
          }
        } catch {
          // Keep polling.
        }
      })();
    }, 600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRunId, status, router]);

  async function runAction(actionTask: string) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matter_id: matterId,
          task: `${actionTask}\n\nCurrent draft:\n${text}`,
          agent_type: "ORCHESTRATOR",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? t.aiRequestFailed);
      }
      setActiveRunId(data.run_id);
      setStatus(data.status);
      setSteps(data.steps ?? []);
      setResult(
        data.result && typeof data.result === "object" ? data.result : null,
      );
      const draft = data.result?.draft;
      if (
        draft &&
        typeof draft === "object" &&
        typeof draft.full_text === "string"
      ) {
        setText(draft.full_text);
      }
      if (data.approval_id) {
        const approvalRes = await fetch(
          `/api/agents/approvals/${data.approval_id}`,
          { credentials: "include" },
        );
        const approval = await approvalRes.json();
        if (approvalRes.ok) {
          setApprovals([
            {
              id: approval.id ?? data.approval_id,
              action: approval.action,
              risk_level: approval.risk_level ?? approval.riskLevel ?? "HIGH",
              description: approval.description,
              status: approval.status,
              agent_run_id:
                approval.agent_run_id ?? approval.agentRunId ?? data.run_id,
              proposed_output:
                approval.proposed_output ?? approval.proposedOutput ?? {},
              requested_at:
                approval.requested_at ??
                approval.requestedAt ??
                new Date().toISOString(),
            },
          ]);
          setShowApproval(true);
        }
      }
      if (!ACTIVE_STATUSES.has(String(data.status))) {
        setBusy(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.aiRequestFailed);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {showApproval && approvals[0] ? (
        <ApprovalDialog
          key={approvals[0].id}
          approval={approvals[0]}
          matterTitle={matterTitle}
          canManage={canManage}
          onResolved={() => {
            setShowApproval(false);
            router.refresh();
          }}
        />
      ) : null}

      <div className="rounded-xl border border-stone-200 bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-stone-500">
              {t.draftLabel}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-stone-900">
              {t.responseDocument}
            </h1>
          </div>
          <button
            type="button"
            disabled={busy || !canManage}
            onClick={() => void runAction(actions[5].task)}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-60"
          >
            {t.review}
          </button>
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={22}
          className="w-full resize-y border-0 bg-transparent px-5 py-5 font-serif text-base leading-7 text-stone-900 outline-none"
          placeholder={t.draftPlaceholder}
        />

        <div className="border-t border-stone-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            {t.ai}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={busy || !canManage}
                onClick={() => void runAction(action.task)}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-60"
              >
                {action.label}
              </button>
            ))}
          </div>
          {status ? (
            <div className="mt-4">
              <AiActivity status={status} steps={steps} result={result} />
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          <p className="mt-3 text-xs text-stone-500">{t.draftAiHint}</p>
          <p className="mt-1 text-xs text-stone-400">
            {t.sourceRun}: {runId}
          </p>
        </div>
      </div>
    </div>
  );
}
