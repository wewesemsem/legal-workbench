import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-[var(--panel)] px-6 py-10 text-center">
      <h3 className="text-base font-medium text-stone-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction && !actionHref ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
