"use client";

import { useI18n } from "@/modules/i18n/provider";

export function CommandPaletteHint() {
  const { t } = useI18n();
  return (
    <div
      data-tour="command-hint"
      className="hidden items-center justify-end gap-2 border-b border-stone-200/80 px-6 py-2 text-xs text-stone-500 lg:flex"
    >
      <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[11px]">
        ⌘K
      </kbd>
      <span>{t.commandPalette}</span>
    </div>
  );
}
