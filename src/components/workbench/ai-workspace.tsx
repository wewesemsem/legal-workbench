"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AiActivity, type AiStep } from "@/components/workbench/ai-activity";
import { AiMarkdown, looksArabic } from "@/components/workbench/ai-markdown";
import {
  ApprovalBanner,
  ApprovalDialog,
  type PendingApproval,
} from "@/components/workbench/approval-dialog";
import {
  CitationChip,
  EvidenceDrawer,
  type EvidenceItem,
} from "@/components/workbench/evidence-drawer";
import {
  MatterContextPanel,
  type ContextConflict,
  type ContextMemoryItem,
} from "@/components/workbench/matter-context-panel";
import {
  ReviewPanel,
  extractReviewIssues,
} from "@/components/workbench/review-panel";
import { aiStatusLabel } from "@/components/workbench/labels";
import { useI18n } from "@/modules/i18n/provider";

type AgentConversationListItem = {
  conversationId: string;
  title: string;
  status: string;
  preview: string;
  runCount: number;
  updatedAt: string;
  createdAt: string;
};

type RunResponse = {
  run_id: string;
  status: string;
  approval_id?: string | null;
  plan?: { workflow?: string; steps?: string[]; rationale?: string };
  steps?: AiStep[];
  result?: Record<string, unknown> | null;
  error?: { message?: string };
  errorSummary?: string | null;
};

type ConversationTurn = {
  id: string;
  userMessage: string;
  run: RunResponse | null;
  error: string | null;
};

const ACTION_TASKS = [
  {
    key: "researchIssue" as const,
    task: "Research the key legal issues in this matter using authoritative Egyptian sources.",
  },
  {
    key: "reviewDocument" as const,
    task: "Review the employment agreement against Egyptian law and identify anything I should be concerned about.",
  },
  {
    key: "draftSomething" as const,
    task: "Draft a response letter addressing the key issues in this matter.",
  },
  {
    key: "analyzeMatter" as const,
    task: "Analyze this matter, summarize the client's position, and list the next recommended actions.",
  },
  {
    key: "askQuestion" as const,
    task: "",
  },
] as const;

const ACTIVE_STATUSES = new Set(["PLANNING", "RUNNING"]);

function nestedString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof row[key] === "string" && row[key].trim()) {
      return row[key] as string;
    }
  }
  return null;
}

function summaryFromResult(result: Record<string, unknown> | null | undefined) {
  if (!result) return null;
  if (typeof result.summary === "string" && result.summary.trim()) {
    return result.summary;
  }
  if (typeof result.answer === "string" && result.answer.trim()) {
    return result.answer;
  }
  if (typeof result.analysis === "string" && result.analysis.trim()) {
    return result.analysis;
  }
  const fromResearch = nestedString(result.research, ["answer", "summary"]);
  if (fromResearch) return fromResearch;
  const fromReview = nestedString(result.review, ["summary"]);
  if (fromReview) return fromReview;
  const steps = result.steps;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      const summary = nestedString(step, ["summary"]);
      if (summary) return summary;
    }
  }
  return null;
}

function citationsFromResult(
  result: Record<string, unknown> | null | undefined,
  matterId: string,
): EvidenceItem[] {
  if (!result) return [];
  const topLevel = Array.isArray(result.citations) ? result.citations : [];
  const research =
    result.research && typeof result.research === "object"
      ? (result.research as Record<string, unknown>)
      : null;
  const fromAuthorities = Array.isArray(research?.authorities)
    ? research.authorities
    : [];
  const citations = topLevel.length ? topLevel : fromAuthorities;
  if (!Array.isArray(citations) || !citations.length) return [];
  return citations.map((item, index) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >;
    const title =
      typeof row.provisionLabel === "string"
        ? row.provisionLabel
        : typeof row.documentTitle === "string"
          ? row.documentTitle
          : typeof row.article === "string"
            ? `Article ${row.article}`
            : typeof row.title === "string"
              ? row.title
              : `Source ${index + 1}`;
    const kind = String(
      row.citationKind ??
        row.source_type ??
        row.sourceType ??
        row.authorityStatus ??
        "LEGAL_CORPUS",
    );
    const page =
      typeof row.pageNumber === "number"
        ? `Page ${row.pageNumber}`
        : typeof row.page === "number"
          ? `Page ${row.page}`
          : undefined;
    const documentId =
      typeof row.documentId === "string"
        ? row.documentId
        : typeof row.matterDocumentId === "string"
          ? row.matterDocumentId
          : null;
    const excerpt =
      typeof row.excerpt === "string"
        ? row.excerpt
        : typeof row.evidence === "string"
          ? row.evidence
          : null;
    const sourceUrl =
      typeof row.sourceUrl === "string"
        ? row.sourceUrl
        : typeof row.source_url === "string"
          ? row.source_url
          : null;
    return {
      id: String(row.legalChunkId ?? row.citation_id ?? row.id ?? index),
      title,
      subtitle:
        typeof row.documentTitle === "string"
          ? row.documentTitle
          : typeof row.title === "string" && title !== row.title
            ? row.title
            : page,
      excerpt,
      sourceType: kind,
      href: documentId
        ? `/app/matters/${matterId}/documents/${documentId}`
        : sourceUrl,
      meta: page,
    };
  });
}

function toRunResponse(data: Record<string, unknown>): RunResponse {
  return {
    run_id: String(data.run_id ?? ""),
    status: String(data.status ?? ""),
    approval_id:
      typeof data.approval_id === "string" || data.approval_id === null
        ? (data.approval_id as string | null)
        : null,
    plan: data.plan as RunResponse["plan"],
    steps: Array.isArray(data.steps) ? (data.steps as AiStep[]) : [],
    result:
      data.result && typeof data.result === "object"
        ? (data.result as Record<string, unknown>)
        : null,
    errorSummary:
      typeof data.errorSummary === "string"
        ? data.errorSummary
        : typeof data.error_summary === "string"
          ? data.error_summary
          : null,
  };
}

function AssistantMessage({
  turn,
  matterId,
  onOpenEvidence,
  onRegenerate,
}: {
  turn: ConversationTurn;
  matterId: string;
  onOpenEvidence: (item: EvidenceItem) => void;
  onRegenerate: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const run = turn.run;
  const summary = summaryFromResult(run?.result);
  const citations = citationsFromResult(run?.result, matterId);
  const issues = extractReviewIssues(run?.result);
  const draftText =
    run?.result?.draft &&
    typeof run.result.draft === "object" &&
    run.result.draft &&
    "full_text" in (run.result.draft as object)
      ? String((run.result.draft as { full_text?: string }).full_text ?? "")
      : "";
  const failed = run?.status === "FAILED" || Boolean(turn.error);
  const working = run ? ACTIVE_STATUSES.has(run.status) : false;
  const responseText =
    summary ||
    (failed
      ? turn.error || run?.errorSummary || t.aiRequestFailed
      : working
        ? null
        : null);

  async function copy() {
    if (!responseText) return;
    try {
      await navigator.clipboard.writeText(responseText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failures.
    }
  }

  return (
    <div className="space-y-3">
      {run ? (
        <AiActivity
          status={run.status}
          steps={run.steps ?? []}
          result={run.result}
        />
      ) : null}

      {working && !responseText ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span className="inline-block animate-spin" aria-hidden>
            ⟳
          </span>
          <span>{t.working}</span>
        </div>
      ) : null}

      {responseText ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
              {t.ai}
            </p>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          {failed && !summary ? (
            <p className="text-sm text-red-700">{responseText}</p>
          ) : (
            <AiMarkdown content={responseText} />
          )}

          {issues.length ? <ReviewPanel issues={issues} /> : null}

          {citations.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
                {t.sources}
              </p>
              <div className="flex flex-wrap gap-2">
                {citations.map((item) => (
                  <CitationChip
                    key={item.id}
                    label={item.title}
                    onClick={() => onOpenEvidence(item)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {draftText ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
                  {t.draftPreview}
                </p>
                {run ? (
                  <Link
                    href={`/app/matters/${matterId}/drafts/${run.run_id}`}
                    className="text-sm text-stone-700 underline"
                  >
                    {t.openInEditor}
                  </Link>
                ) : null}
              </div>
              <pre
                className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-stone-800"
                dir={looksArabic(draftText) ? "rtl" : undefined}
              >
                {draftText}
              </pre>
            </div>
          ) : null}

          {!working ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void copy()}
                className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-50"
              >
                {copied ? t.copied : t.copyResponse}
              </button>
              <button
                type="button"
                onClick={onRegenerate}
                className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-50"
              >
                {t.regenerate}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AIWorkspace({
  matterId,
  matterTitle,
  canManage,
  initialConversations,
  initialApprovals,
  contextMemories,
  contextConflicts,
  counts,
  documents,
}: {
  matterId: string;
  matterTitle: string;
  canManage: boolean;
  initialConversations: AgentConversationListItem[];
  initialApprovals: PendingApproval[];
  contextMemories: ContextMemoryItem[];
  contextConflicts: ContextConflict[];
  counts: {
    documents: number;
    research: number;
    drafts: number;
    memory: number;
  };
  documents: Array<{
    id: string;
    originalFilename: string;
    processingStatus: string;
  }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const presetTask = searchParams.get("task") ?? "";

  const [task, setTask] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [showApproval, setShowApproval] = useState(false);
  const [activeApprovalRunId, setActiveApprovalRunId] = useState<string | null>(
    null,
  );
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [contextOpen, setContextOpen] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const presetStartedRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const activeRun = useMemo(() => {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const run = turns[index]?.run;
      if (run && ACTIVE_STATUSES.has(run.status)) return run;
    }
    return turns[turns.length - 1]?.run ?? null;
  }, [turns]);

  const pendingApproval = useMemo(() => {
    const approvalId =
      turns
        .map((turn) => turn.run?.approval_id)
        .filter(Boolean)
        .at(-1) ?? null;
    if (approvalId) {
      return (
        approvals.find((item) => item.id === approvalId) ??
        approvals[0] ??
        null
      );
    }
    if (activeApprovalRunId) {
      return (
        approvals.find((item) => item.agent_run_id === activeApprovalRunId) ??
        approvals[0] ??
        null
      );
    }
    return approvals[0] ?? null;
  }, [turns, approvals, activeApprovalRunId]);

  const conversationBusy =
    busy ||
    turns.some((turn) => turn.run && ACTIVE_STATUSES.has(turn.run.status));

  // Drop stale ?run= so a refresh lands on a clean workspace URL.
  useEffect(() => {
    if (!searchParams.get("run")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("run");
    const query = params.toString();
    router.replace(
      query
        ? `/app/matters/${matterId}/ai?${query}`
        : `/app/matters/${matterId}/ai`,
    );
  }, [matterId, router, searchParams]);

  useEffect(() => {
    if (!presetTask || presetStartedRef.current) return;
    presetStartedRef.current = true;
    void runTask(presetTask);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for ?task=
  }, [presetTask]);

  useEffect(() => {
    if (!activeRun?.run_id || activeRun.run_id.startsWith("pending-")) return;
    if (!ACTIVE_STATUSES.has(activeRun.status)) return;

    const runId = activeRun.run_id;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/agents/runs/${runId}`, {
            credentials: "include",
          });
          const data = await response.json();
          if (!response.ok || cancelled) return;
          const next = toRunResponse(data);
          setTurns((current) =>
            current.map((turn) =>
              turn.run?.run_id === runId ? { ...turn, run: next } : turn,
            ),
          );
          if (next.status === "WAITING_FOR_APPROVAL") {
            setActiveApprovalRunId(runId);
            setShowApproval(true);
          }
          if (!ACTIVE_STATUSES.has(next.status)) {
            void (async () => {
              try {
                const listResponse = await fetch(
                  `/api/matters/${matterId}/agents`,
                  { credentials: "include" },
                );
                const listData = await listResponse.json();
                if (!listResponse.ok) return;
                setConversations(listData.conversations ?? []);
                setApprovals(listData.pending_approvals ?? []);
              } catch {
                // Ignore list refresh failures after run completion.
              }
            })();
          }
        } catch {
          // Keep polling; transient failures are ignored.
        }
      })();
    }, 600);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRun?.run_id, activeRun?.status, matterId]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node || !stickToBottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [turns, conversationBusy]);

  async function loadMatterAgents() {
    const response = await fetch(`/api/matters/${matterId}/agents`, {
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load AI activity");
    }
    setConversations(data.conversations ?? []);
    setApprovals(data.pending_approvals ?? []);
  }

  async function ensureConversationId(firstMessage: string): Promise<string> {
    const existing = activeConversationIdRef.current;
    if (existing) return existing;

    const response = await fetch(`/api/matters/${matterId}/conversations`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: firstMessage.slice(0, 80) }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to start conversation");
    }
    const conversationId = String(data.conversation?.id ?? "");
    if (!conversationId) {
      throw new Error("Failed to start conversation");
    }
    setActiveConversationId(conversationId);
    activeConversationIdRef.current = conversationId;
    return conversationId;
  }

  async function loadConversation(conversationId: string) {
    const response = await fetch(
      `/api/matters/${matterId}/agents/conversations/${conversationId}`,
      { credentials: "include" },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load conversation");
    }

    const loadedRuns = Array.isArray(data.runs) ? data.runs : [];
    const nextTurns: ConversationTurn[] = loadedRuns.map(
      (run: Record<string, unknown>) => {
        const next = toRunResponse(run);
        return {
          id: crypto.randomUUID(),
          userMessage: typeof run.task === "string" ? run.task : "",
          run: next,
          error: null,
        };
      },
    );

    setActiveConversationId(conversationId);
    activeConversationIdRef.current = conversationId;
    setTurns(nextTurns);
    setError(null);
    stickToBottomRef.current = true;

    const waiting = [...loadedRuns]
      .reverse()
      .find(
        (run: Record<string, unknown>) =>
          run.status === "WAITING_FOR_APPROVAL" &&
          typeof run.run_id === "string",
      ) as { run_id?: string } | undefined;
    if (waiting?.run_id) {
      setActiveApprovalRunId(waiting.run_id);
      setShowApproval(true);
    }
  }

  async function refreshRunIntoTurn(runId: string, turnId?: string) {
    const response = await fetch(`/api/agents/runs/${runId}`, {
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load run");
    }
    const next = toRunResponse(data);
    setTurns((current) => {
      if (turnId) {
        return current.map((turn) =>
          turn.id === turnId ? { ...turn, run: next, error: null } : turn,
        );
      }
      // Avoid duplicating a run already present in the conversation.
      if (current.some((turn) => turn.run?.run_id === runId)) {
        return current.map((turn) =>
          turn.run?.run_id === runId
            ? { ...turn, run: next, error: null }
            : turn,
        );
      }
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          userMessage: typeof data.task === "string" ? data.task : "",
          run: next,
          error: null,
        },
      ];
    });
    if (next.status === "WAITING_FOR_APPROVAL") {
      setActiveApprovalRunId(runId);
      setShowApproval(true);
    }
  }

  async function runTask(nextTask: string, options?: { turnId?: string }) {
    if (!canManage) {
      setError(t.onlyLawyersAi);
      return;
    }
    const trimmed = nextTask.trim();
    if (!trimmed) {
      setError(t.enterRequest);
      return;
    }

    const turnId = options?.turnId ?? crypto.randomUUID();
    setError(null);
    setBusy(true);
    stickToBottomRef.current = true;

    const optimisticRun: RunResponse = {
      run_id: `pending-${turnId}`,
      status: "PLANNING",
      steps: [],
      result: null,
    };

    if (options?.turnId) {
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                run: optimisticRun,
                error: null,
                userMessage: trimmed,
              }
            : turn,
        ),
      );
    } else {
      setTurns((current) => [
        ...current,
        {
          id: turnId,
          userMessage: trimmed,
          run: optimisticRun,
          error: null,
        },
      ]);
    }

    try {
      const conversationId = await ensureConversationId(trimmed);
      const conversationHistory = turns
        .filter((turn) => turn.id !== turnId)
        .flatMap((turn) => {
          const messages: Array<{ role: "user" | "assistant"; content: string }> =
            [];
          if (turn.userMessage.trim()) {
            messages.push({ role: "user", content: turn.userMessage.trim() });
          }
          const assistant =
            summaryFromResult(turn.run?.result) ??
            (turn.run?.errorSummary?.trim() || null);
          if (assistant) {
            messages.push({ role: "assistant", content: assistant.slice(0, 4_000) });
          }
          return messages;
        })
        .slice(-40);

      const response = await fetch("/api/agents/run", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matter_id: matterId,
          task: trimmed,
          agent_type: "ORCHESTRATOR",
          conversation_id: conversationId,
          conversation_history: conversationHistory,
        }),
      });
      const data = (await response.json()) as RunResponse;
      if (!response.ok) {
        throw new Error(data?.error?.message ?? t.aiRequestFailed);
      }

      const next = toRunResponse(data as unknown as Record<string, unknown>);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId ? { ...turn, run: next, error: null } : turn,
        ),
      );
      await loadMatterAgents();
      if (next.approval_id) {
        setActiveApprovalRunId(next.run_id);
        setShowApproval(true);
      }
      if (searchParams.get("run") || searchParams.get("task")) {
        router.replace(`/app/matters/${matterId}/ai`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.aiRequestFailed;
      setError(message);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                error: message,
                run: {
                  run_id: turn.run?.run_id?.startsWith("pending-")
                    ? turn.run.run_id
                    : turn.run?.run_id ?? `failed-${turnId}`,
                  status: "FAILED",
                  steps: turn.run?.steps ?? [],
                  result: null,
                  errorSummary: message,
                },
              }
            : turn,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = task.trim();
    if (!trimmed || conversationBusy) return;
    setTask("");
    await runTask(trimmed);
    composerRef.current?.focus();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void onSubmit();
    }
  }

  function resetConversation() {
    setTurns([]);
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
    setError(null);
    setTask("");
    stickToBottomRef.current = true;
  }

  return (
    <div className="space-y-4">
      <ApprovalBanner
        count={approvals.length}
        onReview={() => setShowApproval(true)}
      />

      {showApproval && pendingApproval ? (
        <ApprovalDialog
          key={pendingApproval.id}
          approval={pendingApproval}
          matterTitle={matterTitle}
          canManage={canManage}
          onResolved={() => {
            setShowApproval(false);
            void loadMatterAgents();
            const runId =
              pendingApproval.agent_run_id || activeApprovalRunId || null;
            if (runId) {
              void refreshRunIntoTurn(runId);
            }
            router.refresh();
          }}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setContextOpen((value) => !value)}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
        >
          {contextOpen ? t.hideContext : t.showContext}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <div className="flex min-h-[70vh] flex-col rounded-xl border border-stone-200 bg-[var(--panel)]">
            <div className="border-b border-stone-200 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    {t.matterAi}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-stone-900">
                    {matterTitle}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {activeRun ? (
                    <p className="text-sm text-stone-500">
                      {aiStatusLabel(activeRun.status, t)}
                    </p>
                  ) : null}
                  {turns.length ? (
                    <button
                      type="button"
                      onClick={resetConversation}
                      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-50"
                    >
                      {t.newConversation}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              ref={threadRef}
              className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5"
              onScroll={() => {
                const node = threadRef.current;
                if (!node) return;
                const distance =
                  node.scrollHeight - node.scrollTop - node.clientHeight;
                stickToBottomRef.current = distance < 80;
              }}
            >
              {!turns.length ? (
                <div data-tour="ai-quick-actions">
                  <p className="text-sm font-medium text-stone-900">
                    {t.whatWouldYouLike}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ACTION_TASKS.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        disabled={conversationBusy || !canManage}
                        onClick={() => {
                          if (action.task) {
                            void runTask(action.task);
                          } else {
                            composerRef.current?.focus();
                          }
                        }}
                        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-60"
                      >
                        {t[action.key]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-stone-600">
                    {t.askAnythingHint}
                  </p>
                </div>
              ) : null}

              {turns.map((turn) => (
                <div key={turn.id} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        {t.you}
                      </p>
                      <div className="h-px flex-1 bg-stone-200" />
                    </div>
                    <p
                      className="whitespace-pre-wrap text-sm leading-6 text-stone-900"
                      dir={looksArabic(turn.userMessage) ? "rtl" : undefined}
                    >
                      {turn.userMessage}
                    </p>
                  </div>

                  <AssistantMessage
                    turn={turn}
                    matterId={matterId}
                    onOpenEvidence={setEvidence}
                    onRegenerate={() => {
                      void runTask(turn.userMessage, { turnId: turn.id });
                    }}
                  />
                </div>
              ))}

              {error && !turns.some((turn) => turn.error === error) ? (
                <p className="text-sm text-red-700">{error}</p>
              ) : null}
            </div>

            <form
              onSubmit={onSubmit}
              data-tour="ai-composer"
              className="sticky bottom-0 border-t border-stone-200 bg-[var(--panel)] px-5 py-4"
            >
              <label className="sr-only" htmlFor="ai-composer">
                {t.askAnything}
              </label>
              <div className="relative rounded-xl border border-stone-300 bg-white focus-within:shadow-[0_0_0_2px_rgba(120,113,108,0.35)]">
                <textarea
                  ref={composerRef}
                  id="ai-composer"
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  rows={2}
                  placeholder={
                    turns.length ? t.followUpPlaceholder : t.askAnything
                  }
                  className="w-full resize-none rounded-xl bg-transparent px-3 py-3 pe-12 text-sm text-stone-900 outline-none"
                />
                <button
                  type="submit"
                  disabled={conversationBusy || !canManage || !task.trim()}
                  className="absolute bottom-2 end-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                  aria-label={t.send}
                >
                  ↑
                </button>
              </div>
              <p className="mt-2 text-xs text-stone-500">{t.examplesPrompt}</p>
            </form>
          </div>

          <section>
            <h3 className="text-sm font-medium text-stone-900">{t.recentWork}</h3>
            {conversations.length ? (
              <ul className="mt-2 space-y-2">
                {conversations.slice(0, 8).map((conversation) => {
                  const active =
                    conversation.conversationId === activeConversationId;
                  return (
                    <li key={conversation.conversationId}>
                      <button
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                          active
                            ? "border-stone-400 bg-stone-50"
                            : "border-stone-200 bg-white"
                        }`}
                        onClick={() => {
                          setError(null);
                          stickToBottomRef.current = true;
                          loadConversation(conversation.conversationId).catch(
                            (err: unknown) => {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : t.aiRequestFailed,
                              );
                            },
                          );
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-stone-900">
                            {aiStatusLabel(conversation.status, t)}
                          </span>
                          {conversation.runCount > 1 ? (
                            <span className="text-xs text-stone-500">
                              {conversation.runCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-stone-600">
                          {conversation.title || conversation.preview}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-500">{t.noAiWork}</p>
            )}
          </section>
        </div>

        <div className={contextOpen ? "block" : "hidden xl:block"}>
          <MatterContextPanel
            matterId={matterId}
            canManage={canManage}
            initialMemories={contextMemories}
            initialConflicts={contextConflicts}
            counts={counts}
            compact
          />
          <div className="mt-4 rounded-xl border border-stone-200 bg-[var(--panel)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {t.documents}
            </p>
            {documents.length ? (
              <ul className="mt-3 space-y-2">
                {documents.slice(0, 6).map((document) => (
                  <li key={document.id}>
                    <Link
                      href={`/app/matters/${matterId}/documents/${document.id}`}
                      className="block text-sm text-stone-800 hover:underline"
                    >
                      {document.originalFilename}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-500">{t.noDocumentsTitle}</p>
            )}
          </div>
        </div>
      </div>

      <EvidenceDrawer
        open={Boolean(evidence)}
        evidence={evidence}
        onClose={() => setEvidence(null)}
      />
    </div>
  );
}
