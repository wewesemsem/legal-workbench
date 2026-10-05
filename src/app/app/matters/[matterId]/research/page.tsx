import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LegalResearchPanel } from "@/components/legal/legal-research-panel";
import { EmptyState } from "@/components/workbench/empty-state";
import { requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { getMatterForUser } from "@/modules/matters/service";

export default async function MatterResearchPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const { matterId } = await params;
  const { t } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  try {
    await getMatterForUser({ matterId, context });
  } catch {
    redirect("/app/matters");
  }

  return (
    <div className="space-y-6" data-tour="matter-research">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">
            {t.researchTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            {t.researchSubtitle}
          </p>
        </div>
        <Link
          href={`/app/matters/${matterId}/ai?task=${encodeURIComponent("Research the key legal issues in this matter using authoritative Egyptian sources.")}`}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {t.researchWithAi}
        </Link>
      </div>

      <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-5">
        <h3 className="text-sm font-medium text-stone-900">
          {t.whatResearching}
        </h3>
        <p className="mt-1 text-sm text-stone-600">{t.researchPreferOfficial}</p>
        <div className="mt-4">
          <Suspense
            fallback={
              <p className="text-sm text-stone-500">{t.researching}</p>
            }
          >
            <LegalResearchPanel
              allowDebug={context.role === "LAWYER"}
              matterId={matterId}
            />
          </Suspense>
        </div>
      </section>

      <EmptyState
        title={t.needFullerWorkflow}
        description={t.needFullerWorkflowBody}
        actionLabel={t.startInMatterAi}
        actionHref={`/app/matters/${matterId}/ai`}
      />
    </div>
  );
}
