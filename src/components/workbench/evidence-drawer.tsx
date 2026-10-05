"use client";

import Link from "next/link";

import { sourceTypeLabel } from "@/components/workbench/labels";
import { StatusBadge } from "@/components/workbench/status-badge";
import { useI18n } from "@/modules/i18n/provider";

export type EvidenceItem = {
  id: string;
  title: string;
  subtitle?: string;
  excerpt?: string | null;
  sourceType: string;
  href?: string | null;
  meta?: string;
};

export function EvidenceDrawer({
  open,
  evidence,
  onClose,
}: {
  open: boolean;
  evidence: EvidenceItem | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!open || !evidence) return null;

  return (
    <div className="fixed inset-y-0 end-0 z-40 flex w-full max-w-md flex-col border-s border-stone-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            {t.evidence}
          </p>
          <h2 className="mt-1 text-lg font-medium text-stone-900">
            {evidence.title}
          </h2>
          {evidence.subtitle ? (
            <p className="mt-1 text-sm text-stone-600">{evidence.subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-stone-300 px-2 py-1 text-sm text-stone-700 hover:bg-stone-50"
        >
          {t.close}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <StatusBadge
          label={sourceTypeLabel(evidence.sourceType, t)}
          tone="info"
        />
        {evidence.meta ? (
          <p className="mt-3 text-xs text-stone-500">{evidence.meta}</p>
        ) : null}
        {evidence.excerpt ? (
          <blockquote className="mt-4 rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-800">
            {evidence.excerpt}
          </blockquote>
        ) : (
          <p className="mt-4 text-sm text-stone-600">{t.openSourceHint}</p>
        )}
      </div>

      {evidence.href ? (
        <div className="border-t border-stone-200 px-5 py-4">
          <Link
            href={evidence.href}
            className="inline-flex rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            onClick={onClose}
          >
            {t.openSource}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function CitationChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-800 hover:bg-stone-50"
    >
      {label}
    </button>
  );
}
