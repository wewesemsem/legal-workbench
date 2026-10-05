import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MatterTabs } from "@/components/workbench/matter-tabs";
import { matterStatusLabel, roleLabel } from "@/components/workbench/labels";
import { StatusBadge } from "@/components/workbench/status-badge";
import { requireAuthContext } from "@/modules/auth/service";
import { listPendingMatterApprovals } from "@/modules/agents/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { getMatterForUser } from "@/modules/matters/service";
import { MATTER_TYPE_LABELS } from "@/modules/matters/types";

export default async function MatterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ matterId: string }>;
}) {
  const { matterId } = await params;
  const { t, locale } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  let matter;
  try {
    matter = await getMatterForUser({ matterId, context });
  } catch {
    redirect("/app/matters");
  }

  const pendingApprovals = await listPendingMatterApprovals({
    matterId,
    context,
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href="/app/matters"
        className="text-sm text-stone-600 hover:text-stone-900"
      >
        ← {t.backToMatters}
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
              {matter.title}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {MATTER_TYPE_LABELS[matter.matterType]}
              {matter.description ? ` · ${matter.description}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge
                label={matterStatusLabel(matter.status, t)}
                tone={matter.status === "OPEN" ? "success" : "neutral"}
              />
              <span className="text-xs text-stone-500">
                {t.yourRole}: {roleLabel(matter.memberRole ?? "LAWYER", t)}
              </span>
              <span className="text-xs text-stone-500">
                {t.updated}{" "}
                {new Date(matter.updatedAt).toLocaleDateString(locale)}
              </span>
            </div>
          </div>
          <Link
            href={`/app/matters/${matterId}/ai`}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t.askAi}
          </Link>
        </div>

        {pendingApprovals.length ? (
          <div
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
            role="status"
          >
            <p className="text-sm font-medium text-amber-950">
              {t.approvalRequired}
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {t.approvalRequiredBody}
            </p>
            <Link
              href={`/app/matters/${matterId}/ai`}
              className="mt-2 inline-flex text-sm font-medium text-stone-900 underline"
            >
              {t.reviewNow}
            </Link>
          </div>
        ) : null}

        <MatterTabs matterId={matterId} />
      </header>

      <div className="mt-6">{children}</div>
    </div>
  );
}
