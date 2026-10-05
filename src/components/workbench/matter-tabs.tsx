"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/modules/i18n/provider";

export function MatterTabs({ matterId }: { matterId: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const base = `/app/matters/${matterId}`;

  const tabs = [
    { segment: "", label: t.overview },
    { segment: "ai", label: t.ai },
    { segment: "documents", label: t.documents },
    { segment: "research", label: t.research },
    { segment: "drafts", label: t.drafts },
    { segment: "activity", label: t.activity },
  ] as const;

  function isActive(segment: string) {
    if (!segment) {
      return pathname === base;
    }
    return (
      pathname === `${base}/${segment}` ||
      pathname.startsWith(`${base}/${segment}/`)
    );
  }

  return (
    <nav
      data-tour="matter-tabs"
      className="mt-5 flex gap-1 overflow-x-auto border-b border-stone-200"
      aria-label="Matter sections"
    >
      {tabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = isActive(tab.segment);
        return (
          <Link
            key={tab.segment || "overview"}
            href={href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
              active
                ? "border-[var(--accent)] font-medium text-stone-900"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
