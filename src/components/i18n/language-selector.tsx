"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LOCALES, LOCALE_META } from "@/modules/i18n/config";
import { useI18n } from "@/modules/i18n/provider";

export function LanguageSelector({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locale, setLocale, t, pending } = useI18n();

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "" : ""}`}
      role="group"
      aria-label={t.language}
    >
      {!compact ? (
        <span className="hidden text-xs font-medium uppercase tracking-[0.12em] text-stone-500 sm:inline">
          {t.language}
        </span>
      ) : null}
      <label className="sr-only" htmlFor="language-selector">
        {t.language}
      </label>
      <select
        id="language-selector"
        value={locale}
        disabled={pending}
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-800 outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:opacity-60"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LanguageBar() {
  return (
    <div className="flex items-center justify-end gap-2 border-b border-stone-200/80 bg-[var(--panel)]/90 px-4 py-2 backdrop-blur sm:gap-3 sm:px-6">
      <ThemeToggle />
      <LanguageSelector />
    </div>
  );
}
