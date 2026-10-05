import Link from "next/link";

import type { Messages } from "@/modules/i18n/messages";

export type ActivityItem = {
  id: string;
  at: Date;
  title: string;
  href: string;
  kind: "document" | "ai";
};

function dayLabel(date: Date, t: Messages, locale: string) {
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startThat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff = startToday.getTime() - startThat.getTime();
  if (diff === 0) return t.today;
  if (diff === 86400000) return t.yesterday;
  return date.toLocaleDateString(locale);
}

export function ActivityTimeline({
  items,
  t,
  locale = "en",
}: {
  items: ActivityItem[];
  t: Messages;
  locale?: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-stone-600">{t.noActivityBody}</p>;
  }

  const groups = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const key = dayLabel(item.at, t, locale);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([day, dayItems]) => (
        <section key={day}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            {day}
          </h3>
          <ol className="mt-3 space-y-2">
            {dayItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex gap-4 rounded-md border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50"
                >
                  <time className="w-16 shrink-0 text-xs text-stone-500">
                    {item.at.toLocaleTimeString(locale, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  <span className="text-sm text-stone-800">{item.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
