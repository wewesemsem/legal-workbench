"use client";

import { useI18n } from "@/modules/i18n/provider";
import type { Messages } from "@/modules/i18n/messages";

export type ReviewIssue = {
  id: string;
  severity: "high" | "medium" | "info";
  title: string;
  explanation: string;
  recommendation?: string;
  href?: string;
};

function severityMeta(severity: ReviewIssue["severity"], t: Messages) {
  switch (severity) {
    case "high":
      return {
        label: t.high,
        className: "border-red-200 bg-red-50 text-red-900",
      };
    case "medium":
      return {
        label: t.medium,
        className: "border-amber-200 bg-amber-50 text-amber-950",
      };
    default:
      return {
        label: t.informational,
        className: "border-sky-200 bg-sky-50 text-sky-950",
      };
  }
}

export function ReviewPanel({
  issues,
  onSelect,
}: {
  issues: ReviewIssue[];
  onSelect?: (issue: ReviewIssue) => void;
}) {
  const { t } = useI18n();
  if (!issues.length) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-stone-900">
          {issues.length}{" "}
          {issues.length === 1 ? t.issueFound : t.issuesFound}
        </h3>
      </div>
      <ul className="mt-3 space-y-3">
        {issues.map((issue) => {
          const meta = severityMeta(issue.severity, t);
          return (
            <li
              key={issue.id}
              className={`rounded-md border px-3 py-3 ${meta.className}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em]">
                    {meta.label}
                  </p>
                  <p className="mt-1 text-sm font-medium">{issue.title}</p>
                  <p className="mt-1 text-sm opacity-90">{issue.explanation}</p>
                  {issue.recommendation ? (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">{t.recommended}: </span>
                      {issue.recommendation}
                    </p>
                  ) : null}
                </div>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(issue)}
                    className="rounded-md border border-current/20 bg-white/70 px-2.5 py-1 text-xs font-medium"
                  >
                    {t.view}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function extractReviewIssues(
  result: Record<string, unknown> | null | undefined,
): ReviewIssue[] {
  if (!result) return [];

  const candidates =
    (result.issues as unknown) ??
    (result.findings as unknown) ??
    (result.review as Record<string, unknown> | undefined)?.issues ??
    [];

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((item, index): ReviewIssue | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title =
        typeof row.title === "string"
          ? row.title
          : typeof row.issue === "string"
            ? row.issue
            : typeof row.clause === "string"
              ? row.clause
              : `Issue ${index + 1}`;
      const explanation =
        typeof row.explanation === "string"
          ? row.explanation
          : typeof row.reason === "string"
            ? row.reason
            : typeof row.summary === "string"
              ? row.summary
              : "Potential concern identified.";
      const severityRaw = String(
        row.severity ?? row.level ?? "medium",
      ).toLowerCase();
      const severity: ReviewIssue["severity"] =
        severityRaw.includes("high") || severityRaw.includes("critical")
          ? "high"
          : severityRaw.includes("info") || severityRaw.includes("low")
            ? "info"
            : "medium";
      return {
        id: String(row.id ?? index),
        severity,
        title,
        explanation,
        recommendation:
          typeof row.recommendation === "string"
            ? row.recommendation
            : typeof row.suggested_action === "string"
              ? row.suggested_action
              : undefined,
      };
    })
    .filter((item): item is ReviewIssue => Boolean(item));
}
