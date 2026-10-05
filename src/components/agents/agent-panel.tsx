"use client";

import { FormEvent, useMemo, useState } from "react";

import { humanizeStep } from "@/components/workbench/labels";
import { useI18n } from "@/modules/i18n/provider";

type AgentStep = {
  sequence: number;
  agentType: string;
  action: string;
  tool: string | null;
  status: string;
  summary?: string;
};

type PendingApproval = {
  id: string;
  action: string;
  risk_level: string;
  description: string;
  status: string;
  agent_run_id: string;
  proposed_output: Record<string, unknown>;
  requested_at: string;
};

type AgentRunListItem = {
  runId: string;
  status: string;
  agentType: string;
  task: string;
  createdAt: string;
  workflow: string | null;
};

type RunResponse = {
  run_id: string;
  status: string;
  approval_id?: string | null;
  plan?: { workflow?: string; steps?: string[]; rationale?: string };
  steps?: AgentStep[];
  result?: Record<string, unknown> | null;
  error?: { message?: string };
};

const QUICK_ACTIONS = [
  {
    label: "Research this matter",
    task: "Find Egyptian law relevant to this employment matter",
  },
  {
    label: "Analyze document",
    task: "Analyze the uploaded contract and extract key clauses",
  },
  {
    label: "Draft document",
    task: "Draft a letter explaining the legal issues identified in this matter",
  },
  {
    label: "Review draft",
    task: "Review the latest analysis for unsupported claims and missing citations",
  },
  {
    label: "Remember client",
    task: "The client is ABC Holdings. Remember that.",
  },
  {
    label: "Full contract letter workflow",
    task:
      "Review this employment contract against Egyptian law, identify the legal issues, and draft a letter explaining the issues.",
  },
] as const;

function statusLabel(status: string) {
  switch (status) {
    case "PLANNING":
      return "Planning";
    case "RUNNING":
      return "Running";
    case "WAITING_FOR_APPROVAL":
      return "Waiting for approval";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    case "INCOMPLETE":
      return "Incomplete";
    default:
      return status;
  }
}

function stepIcon(status: string) {
  if (status === "COMPLETED") return "✓";
  if (status === "FAILED") return "✕";
  if (status === "RUNNING" || status === "PENDING") return "⏳";
  return "•";
}

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

export function AgentPanel({
  matterId,
  matterTitle,
  canManage,
  initialRuns,
  initialApprovals,
}: {
  matterId: string;
  matterTitle: string;
  canManage: boolean;
  initialRuns: AgentRunListItem[];
  initialApprovals: PendingApproval[];
}) {
  const { t, locale } = useI18n();
  const [task, setTask] = useState<string>(QUICK_ACTIONS[4].task);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<RunResponse | null>(null);
  const [runs, setRuns] = useState<AgentRunListItem[]>(initialRuns);
  const [approvals, setApprovals] = useState<PendingApproval[]>(initialApprovals);
  const [editText, setEditText] = useState(
    draftTextFromApproval(initialApprovals[0] ?? null),
  );

  const pendingApproval = useMemo(() => {
    if (activeRun?.approval_id) {
      return (
        approvals.find((item) => item.id === activeRun.approval_id) ??
        approvals[0] ??
        null
      );
    }
    return approvals[0] ?? null;
  }, [activeRun, approvals]);

  async function loadMatterAgents() {
    const response = await fetch(`/api/matters/${matterId}/agents`, {
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load agent runs");
    }
    const nextApprovals = (data.pending_approvals ?? []) as PendingApproval[];
    setRuns(data.runs ?? []);
    setApprovals(nextApprovals);
    if (nextApprovals[0]) {
      setEditText(draftTextFromApproval(nextApprovals[0]));
    }
  }

  async function refreshRun(runId: string) {
    const response = await fetch(`/api/agents/runs/${runId}`, {
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load run");
    }
    setActiveRun({
      run_id: data.run_id,
      status: data.status,
      approval_id: data.approval_id,
      plan: data.plan,
      steps: data.steps,
      result: data.result,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) {
      setError("Only lawyers can run AI agents.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matter_id: matterId,
          task,
          agent_type: "ORCHESTRATOR",
        }),
      });
      const data = (await response.json()) as RunResponse;
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Agent run failed");
      }
      setActiveRun(data);
      await loadMatterAgents();
      if (data.approval_id) {
        const approvalRes = await fetch(
          `/api/agents/approvals/${data.approval_id}`,
          { credentials: "include" },
        );
        const approval = (await approvalRes.json()) as {
          action?: string;
          proposed_output?: Record<string, unknown>;
        };
        if (approval.action === "save_matter_memory") {
          setEditText(String(approval.proposed_output?.value ?? ""));
        } else if (typeof approval.proposed_output?.full_text === "string") {
          setEditText(approval.proposed_output.full_text);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(
    approvalId: string,
    decision: "APPROVED" | "REJECTED" | "EDITED",
  ) {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { decision };
      if (decision === "EDITED") {
        if (pendingApproval?.action === "save_matter_memory") {
          body.edited_output = {
            ...(pendingApproval.proposed_output ?? {}),
            value: editText,
          };
        } else {
          body.edited_output = {
            ...(pendingApproval?.proposed_output ?? {}),
            full_text: editText,
          };
        }
      }
      const response = await fetch(`/api/agents/approvals/${approvalId}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Approval failed");
      }
      if (activeRun?.run_id) {
        await refreshRun(activeRun.run_id);
      }
      await loadMatterAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-600">
          Controlled AI agents research, analyze documents, draft, and review
          inside this matter. Legal facts come from tools and evidence. High-impact
          drafts require lawyer approval.
        </p>
      </div>

      {canManage ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-stone-900">
            Task for the orchestrator
            <textarea
              value={task}
              onChange={(event) => setTask(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => setTask(action.task)}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {busy ? "Running…" : "Run AI agents"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-stone-600">
          Clients can view matter activity but cannot run research, drafting, or
          review agents.
        </p>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {activeRun ? (
        <div className="rounded-md border border-stone-200 bg-white p-4">
          <h3 className="text-sm font-medium text-stone-900">Agent Run</h3>
          <p className="mt-1 text-sm text-stone-600">
            Status: {statusLabel(activeRun.status)}
            {activeRun.plan?.workflow ? ` · ${activeRun.plan.workflow}` : ""}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-stone-700">
            {(activeRun.steps ?? []).map((step) => (
              <li key={`${step.sequence}-${step.action}`}>
                <span className="mr-2">{stepIcon(step.status)}</span>
                {humanizeStep(step, t, locale)}
              </li>
            ))}
          </ul>
          {activeRun.result?.draft &&
          typeof activeRun.result.draft === "object" &&
          activeRun.result.draft &&
          "full_text" in (activeRun.result.draft as object) ? (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-stone-900">Draft preview</h4>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs text-stone-800">
                {String(
                  (activeRun.result.draft as { full_text?: string }).full_text ??
                    "",
                )}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {pendingApproval ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
            AI action requires review
          </p>
          <dl className="mt-3 space-y-2 text-sm text-stone-800">
            <div>
              <dt className="text-stone-500">Agent</dt>
              <dd className="font-medium">
                {pendingApproval.action === "save_matter_memory"
                  ? "Memory"
                  : "Drafting Agent"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Action</dt>
              <dd className="font-medium">{pendingApproval.action}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Matter</dt>
              <dd className="font-medium">{matterTitle}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Reason</dt>
              <dd>{pendingApproval.description}</dd>
            </div>
          </dl>
          {pendingApproval.action === "save_matter_memory" ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-white p-3 text-sm text-stone-800">
              <p className="font-medium">
                Save to Matter Memory:{" "}
                {String(pendingApproval.proposed_output.key ?? "")} ={" "}
                {String(pendingApproval.proposed_output.value ?? "")}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Source:{" "}
                {String(pendingApproval.proposed_output.source_type ?? "USER_PROVIDED")}
              </p>
              <label className="mt-3 block text-sm font-medium text-stone-900">
                Edit value before confirm
                <input
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          ) : (
            <label className="mt-4 block text-sm font-medium text-stone-900">
              Proposed draft
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={10}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !canManage}
              onClick={() => decide(pendingApproval.id, "APPROVED")}
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-60"
            >
              {pendingApproval.action === "save_matter_memory"
                ? "Confirm"
                : "Approve"}
            </button>
            <button
              type="button"
              disabled={busy || !canManage}
              onClick={() => decide(pendingApproval.id, "EDITED")}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-60"
            >
              Edit & approve
            </button>
            <button
              type="button"
              disabled={busy || !canManage}
              onClick={() => decide(pendingApproval.id, "REJECTED")}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-medium text-stone-900">Recent agent runs</h3>
        {runs.length ? (
          <ul className="mt-2 space-y-2">
            {runs.map((run) => (
              <li key={run.runId}>
                <button
                  type="button"
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:bg-stone-50"
                  onClick={() => {
                    refreshRun(run.runId).catch((err: unknown) => {
                      setError(
                        err instanceof Error ? err.message : "Failed to load run",
                      );
                    });
                  }}
                >
                  <span className="font-medium text-stone-900">
                    {statusLabel(run.status)}
                  </span>
                  <span className="text-stone-500">
                    {" "}
                    · {run.workflow ?? run.agentType}
                  </span>
                  <p className="mt-1 text-stone-600 line-clamp-2">{run.task}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-stone-600">No agent runs yet.</p>
        )}
      </div>
    </div>
  );
}
