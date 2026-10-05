"use client";

import { useEffect, useRef, useState } from "react";

import { humanizeStep } from "@/components/workbench/labels";
import { useI18n } from "@/modules/i18n/provider";
import type { Messages } from "@/modules/i18n/messages";

export type AiStep = {
  sequence: number;
  agentType: string;
  action: string;
  tool: string | null;
  status: string;
  summary?: string;
};

function isWorkingStatus(status: string) {
  return status === "PLANNING" || status === "RUNNING";
}

function isTerminalStatus(status: string) {
  return (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "INCOMPLETE" ||
    status === "WAITING_FOR_APPROVAL"
  );
}

function titleForStatus(status: string, t: Messages) {
  if (status === "PLANNING" || status === "RUNNING") return t.researching;
  if (status === "FAILED") return t.researchFailed;
  if (status === "WAITING_FOR_APPROVAL") return t.statusWaitingApproval;
  return t.researchCompleted;
}

function countFromResult(
  result: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!result) return 0;
  for (const key of keys) {
    const value = result[key];
    if (Array.isArray(value)) return value.length;
  }
  const research =
    result.research && typeof result.research === "object"
      ? (result.research as Record<string, unknown>)
      : null;
  if (research) {
    for (const key of keys) {
      const value = research[key];
      if (Array.isArray(value)) return value.length;
    }
  }
  return 0;
}

function researchTargetLabel(
  result: Record<string, unknown> | null | undefined,
  t: Messages,
): string | null {
  if (!result) return null;
  const target =
    result.researchTarget && typeof result.researchTarget === "object"
      ? (result.researchTarget as Record<string, unknown>)
      : result.research &&
          typeof result.research === "object" &&
          (result.research as Record<string, unknown>).researchTarget &&
          typeof (result.research as Record<string, unknown>).researchTarget ===
            "object"
        ? ((result.research as Record<string, unknown>)
            .researchTarget as Record<string, unknown>)
        : null;
  if (!target) return null;

  const document =
    typeof target.document === "string" && target.document.trim()
      ? target.document.trim()
      : null;
  const articles = Array.isArray(target.targetArticles)
    ? target.targetArticles.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      )
    : [];
  if (document && articles.length === 1) {
    return `${document} · ${t.articleLabel} ${articles[0]}`;
  }
  if (document) return document;
  if (articles.length === 1) return `${t.articleLabel} ${articles[0]}`;
  return null;
}

function preferredProcessSummaries(
  steps: AiStep[],
  t: Messages,
  locale: "en" | "fr" | "ar",
): string[] {
  const preferredActions = new Set([
    "conversation.resolve",
    "research.target",
    "research.validate_evidence",
    "research.retrieved_target",
    "research.retry_retrieval",
  ]);
  const preferredTools = new Set([
    "search_legal_corpus",
    "retrieve_legal_provision",
    "create_draft",
  ]);

  return steps
    .filter((step) => {
      if (step.status === "FAILED") return false;
      if (preferredActions.has(step.action)) return true;
      if (step.tool && preferredTools.has(step.tool)) {
        return true;
      }
      return false;
    })
    .map((step) => humanizeStep(step, t, locale))
    .filter((summary): summary is string => Boolean(summary))
    .slice(0, 6);
}

function buildCollapsedSummary(
  status: string,
  steps: AiStep[],
  result: Record<string, unknown> | null | undefined,
  t: Messages,
  locale: "en" | "fr" | "ar",
) {
  if (status === "FAILED") {
    return t.researchFailed;
  }

  const title =
    status === "WAITING_FOR_APPROVAL"
      ? t.statusWaitingApproval
      : t.researchCompleted;

  const targetLabel = researchTargetLabel(result, t);
  const process = preferredProcessSummaries(steps, t, locale);
  if (targetLabel) {
    return `${title} · ${targetLabel}`;
  }
  if (process.length) {
    return `${title} · ${process[process.length - 1]}`;
  }

  const research =
    result?.research && typeof result.research === "object"
      ? (result.research as Record<string, unknown>)
      : null;
  const validated =
    typeof research?.validatedEvidenceCount === "number"
      ? research.validatedEvidenceCount
      : null;

  const evidence =
    validated ??
    countFromResult(result, ["citations", "evidenceIds", "citationIds"]) ??
    0;
  const provisions =
    validated ??
    countFromResult(result, ["authorities"]) ??
    0;

  const parts: string[] = [];
  if (evidence) {
    parts.push(`${evidence} ${t.evidenceItemsCount}`);
  } else if (provisions) {
    parts.push(`${provisions} ${t.legalProvisionsCount}`);
  }

  if (!parts.length) {
    return title;
  }

  return `${title} · ${parts.join(" · ")}`;
}

function StepIcon({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="text-emerald-700" aria-hidden>
        ✓
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="text-red-600" aria-hidden>
        ✕
      </span>
    );
  }
  if (status === "RUNNING" || status === "PENDING") {
    return (
      <span
        className="inline-block animate-spin text-stone-500"
        aria-hidden
      >
        ⟳
      </span>
    );
  }
  return (
    <span className="text-stone-400" aria-hidden>
      ○
    </span>
  );
}

export function AiActivity({
  status,
  steps,
  result,
  defaultExpanded,
}: {
  status: string;
  steps: AiStep[];
  result?: Record<string, unknown> | null;
  defaultExpanded?: boolean;
}) {
  const { t, locale } = useI18n();
  const working = isWorkingStatus(status);
  const finished = isTerminalStatus(status);
  const autoExpand =
    working ||
    status === "FAILED" ||
    status === "WAITING_FOR_APPROVAL";
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? autoExpand,
  );
  const [trackedStatus, setTrackedStatus] = useState(status);
  const listRef = useRef<HTMLUListElement>(null);
  const stickToBottomRef = useRef(true);
  const previousCountRef = useRef(0);

  if (status !== trackedStatus) {
    setTrackedStatus(status);
    if (working || status === "WAITING_FOR_APPROVAL") {
      setExpanded(true);
    } else if (finished && status !== "FAILED") {
      setExpanded(false);
    }
  }

  useEffect(() => {
    const node = listRef.current;
    if (!node || !expanded || !working) return;
    if (!stickToBottomRef.current) return;
    if (steps.length === previousCountRef.current && steps.length > 0) {
      // Still scroll when an in-place status flips to running/completed.
      node.scrollTop = node.scrollHeight;
      return;
    }
    previousCountRef.current = steps.length;
    node.scrollTop = node.scrollHeight;
  }, [steps, expanded, working, status]);

  const visibleSteps =
    steps.length > 0
      ? steps
      : working
        ? [
            {
              sequence: 0,
              agentType: "ORCHESTRATOR",
              action: "orchestrator.plan",
              tool: null,
              status: "RUNNING",
              summary: t.researching,
            },
          ]
        : [];

  const collapsedLabel = buildCollapsedSummary(
    status,
    steps,
    result,
    t,
    locale,
  );

  if (!working && finished && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group flex w-full items-start gap-2 rounded-lg border border-transparent px-1 py-1.5 text-left text-sm text-stone-600 transition hover:bg-stone-50"
        aria-expanded={false}
      >
        <span className="mt-0.5 text-emerald-700" aria-hidden>
          {status === "FAILED" ? "✕" : "✓"}
        </span>
        <span className="min-w-0 flex-1 leading-5">{collapsedLabel}</span>
        <span className="shrink-0 text-stone-400 transition group-hover:text-stone-600">
          ▸
        </span>
      </button>
    );
  }

  return (
    <div
      className="rounded-lg border border-stone-200/80 bg-stone-50/80 px-3 py-2.5"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-800">
            {titleForStatus(status, t)}
          </p>
          {!working ? (
            <p className="mt-0.5 truncate text-xs text-stone-500">
              {collapsedLabel.replace(/^[^·]+·\s*/, "")}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-stone-400" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded ? (
        <ul
          ref={listRef}
          className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-sm text-stone-700"
          onScroll={() => {
            const node = listRef.current;
            if (!node) return;
            const distance =
              node.scrollHeight - node.scrollTop - node.clientHeight;
            stickToBottomRef.current = distance < 40;
          }}
        >
          {visibleSteps.map((step) => {
            const label = humanizeStep(step, t, locale);
            return (
              <li
                key={`${step.sequence}-${step.action}-${step.tool ?? ""}`}
                className="ai-step-enter flex gap-2"
              >
                <span className="w-4 shrink-0 pt-0.5">
                  <StepIcon status={step.status} />
                </span>
                <span
                  className={
                    step.status === "FAILED"
                      ? "text-red-700"
                      : step.status === "RUNNING" || step.status === "PENDING"
                        ? "text-stone-800"
                        : "text-stone-700"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
