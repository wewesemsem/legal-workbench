"use client";

import { useI18n } from "@/modules/i18n/provider";
import { useTheme } from "@/modules/theme/provider";

export function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { resolved, toggleNightMode } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggleNightMode}
      className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-800 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-stone-400"
      aria-pressed={isDark}
      aria-label={isDark ? t.themeSwitchToLight : t.themeSwitchToDark}
      title={isDark ? t.themeSwitchToLight : t.themeSwitchToDark}
    >
      <span aria-hidden className="text-base leading-none">
        {isDark ? "☀" : "☾"}
      </span>
      {!compact ? (
        <span className="hidden sm:inline">
          {isDark ? t.themeLight : t.themeDark}
        </span>
      ) : null}
    </button>
  );
}
