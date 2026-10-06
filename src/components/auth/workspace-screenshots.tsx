import Image from "next/image";

import { getRequestI18n } from "@/modules/i18n/server";

const SHOTS = [
  {
    src: "/screenshots/matter-overview.jpg",
    altKey: "authShotOverview" as const,
  },
  {
    src: "/screenshots/matter-ai.jpg",
    altKey: "authShotAi" as const,
  },
  {
    src: "/screenshots/legal-research.jpg",
    altKey: "authShotResearch" as const,
  },
  {
    src: "/screenshots/draft-approval.jpg",
    altKey: "authShotApproval" as const,
  },
] as const;

export async function WorkspaceScreenshots({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t } = await getRequestI18n();

  if (compact) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            {t.brand}
          </p>
          <p className="mt-1 text-sm text-stone-600">{t.authShowcaseBody}</p>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {SHOTS.map((shot) => (
            <figure
              key={shot.src}
              className="w-[78%] shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-[var(--panel)] shadow-md shadow-stone-900/10 sm:w-[55%]"
            >
              <Image
                src={shot.src}
                alt={t[shot.altKey]}
                width={1024}
                height={640}
                className="h-auto w-full object-cover object-top"
                sizes="80vw"
                priority
              />
            </figure>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between gap-8 px-8 py-10 xl:px-12 xl:py-12">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">
          {t.brand}
        </p>
        <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-stone-900 xl:text-4xl">
          {t.authShowcaseTitle}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-stone-600">
          {t.authShowcaseBody}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:gap-4">
        {SHOTS.map((shot) => (
          <figure
            key={shot.src}
            className="overflow-hidden rounded-xl border border-stone-200 bg-[var(--panel)] shadow-lg shadow-stone-900/10 ring-1 ring-stone-900/5"
          >
            <Image
              src={shot.src}
              alt={t[shot.altKey]}
              width={1024}
              height={640}
              className="h-auto w-full object-cover object-top"
              sizes="(min-width: 1024px) 26vw, 50vw"
              priority
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
