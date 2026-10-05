export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-800"
          : tone === "info"
            ? "border-sky-200 bg-sky-50 text-sky-900"
            : "border-stone-200 bg-stone-50 text-stone-700";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}

export function documentStatusTone(status: string) {
  switch (status) {
    case "READY":
    case "PROCESSED":
    case "COMPLETED":
    case "INDEXED":
      return "success" as const;
    case "PROCESSING":
    case "UPLOADED":
      return "info" as const;
    case "FAILED":
      return "danger" as const;
    case "NEEDS_ATTENTION":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function aiStatusTone(status: string) {
  switch (status) {
    case "COMPLETED":
      return "success" as const;
    case "WAITING_FOR_APPROVAL":
      return "warning" as const;
    case "FAILED":
      return "danger" as const;
    case "RUNNING":
    case "PLANNING":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}
