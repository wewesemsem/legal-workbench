import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ActivityTimeline } from "@/components/workbench/activity-timeline";
import { EmptyState } from "@/components/workbench/empty-state";
import { requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";
import { getMatterForUser } from "@/modules/matters/service";
import { buildMatterActivity } from "@/modules/workbench/queries";

export default async function MatterActivityPage({
  params,
}: {
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

  try {
    await getMatterForUser({ matterId, context });
  } catch {
    redirect("/app/matters");
  }

  const activity = await buildMatterActivity({ matterId, context });

  return (
    <div className="space-y-6" data-tour="matter-activity">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">
          {t.activityTitle}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{t.activitySubtitle}</p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-[var(--panel)] p-5">
        {activity.length ? (
          <ActivityTimeline items={activity} t={t} locale={locale} />
        ) : (
          <EmptyState
            title={t.noActivityTitle}
            description={t.noActivityBody}
            actionLabel={t.askAi}
            actionHref={`/app/matters/${matterId}/ai`}
          />
        )}
      </section>
    </div>
  );
}
