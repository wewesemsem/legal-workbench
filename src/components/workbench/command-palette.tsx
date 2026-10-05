"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { startWorkbenchTour } from "@/components/workbench/workbench-tour";
import { startWorkflowDemo } from "@/components/workbench/workflow-demo-guide";
import { useI18n } from "@/modules/i18n/provider";

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: "replay-tour" | "workflow-demo";
  group: string;
};

export function CommandPalette({
  matters,
  documents,
}: {
  matters: Array<{ id: string; title: string }>;
  documents: Array<{
    id: string;
    matterId: string;
    originalFilename: string;
  }>;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const items = useMemo(() => {
    const base: CommandItem[] = [
      {
        id: "home",
        label: t.goToHome,
        href: "/app",
        group: t.navigate,
      },
      {
        id: "matters",
        label: t.browseMatters,
        href: "/app/matters",
        group: t.navigate,
      },
      {
        id: "documents",
        label: t.browseDocumentsNav,
        href: "/app/documents",
        group: t.navigate,
      },
      {
        id: "clients",
        label: t.browseClients,
        href: "/app/clients",
        group: t.navigate,
      },
      {
        id: "legal",
        label: t.publicLawResearch,
        href: "/app/legal",
        group: t.navigate,
      },
      {
        id: "workflow-demo",
        label: t.demoStart,
        hint: t.demoPageBody,
        action: "workflow-demo",
        group: t.navigate,
      },
      {
        id: "replay-tour",
        label: t.tourRestart,
        hint: t.tourRestartHint,
        action: "replay-tour",
        group: t.navigate,
      },
      ...matters.slice(0, 12).flatMap((matter) => [
        {
          id: `matter-${matter.id}`,
          label: matter.title,
          hint: t.openMatter,
          href: `/app/matters/${matter.id}`,
          group: t.matters,
        },
        {
          id: `ai-${matter.id}`,
          label: `${t.askAiDash} ${matter.title}`,
          hint: t.matterAi,
          href: `/app/matters/${matter.id}/ai`,
          group: t.ai,
        },
        {
          id: `research-${matter.id}`,
          label: `${t.researchDash} ${matter.title}`,
          href: `/app/matters/${matter.id}/research`,
          group: t.ai,
        },
        {
          id: `draft-${matter.id}`,
          label: `${t.draftDash} ${matter.title}`,
          href: `/app/matters/${matter.id}/ai?task=${encodeURIComponent("Draft a response letter for this matter")}`,
          group: t.ai,
        },
      ]),
      ...documents.slice(0, 20).map((document) => ({
        id: `doc-${document.id}`,
        label: document.originalFilename,
        hint: t.document,
        href: `/app/matters/${document.matterId}/documents/${document.id}`,
        group: t.documents,
      })),
    ];

    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint?.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [documents, matters, query, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/40 px-4 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t.closeCommandPalette}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.commandPalette}
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
      >
        <div className="border-b border-stone-200 px-4 py-3">
          <label className="sr-only" htmlFor="command-palette-input">
            {t.commandWhatToDo}
          </label>
          <input
            id="command-palette-input"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.commandSearchPlaceholder}
            className="w-full border-0 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {items.length ? (
            items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-stone-50"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    if (item.action === "workflow-demo") {
                      startWorkflowDemo();
                      return;
                    }
                    if (item.action === "replay-tour") {
                      startWorkbenchTour("shell");
                      return;
                    }
                    if (item.href) {
                      router.push(item.href);
                    }
                  }}
                >
                  <span>
                    <span className="block text-sm text-stone-900">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="block text-xs text-stone-500">
                        {item.hint}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-stone-400">{item.group}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-6 text-sm text-stone-500">{t.noMatches}</li>
          )}
        </ul>
        <div className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500">
          {t.commandPaletteFooter}
        </div>
      </div>
    </div>
  );
}
