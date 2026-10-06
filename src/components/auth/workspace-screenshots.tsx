import Image from "next/image";

import { getRequestI18n } from "@/modules/i18n/server";

const SHOTS = [
  {
    src: "/screenshots/matter-overview.png",
    altKey: "authShotOverview" as const,
    className:
      "absolute start-[4%] top-[8%] z-20 w-[72%] rotate-[-2.5deg] shadow-2xl shadow-stone-900/20",
  },
  {
    src: "/screenshots/matter-ai.png",
    altKey: "authShotAi" as const,
    className:
      "absolute end-[2%] top-[18%] z-10 w-[58%] rotate-[3deg] shadow-2xl shadow-stone-900/15",
  },
  {
    src: "/screenshots/legal-research.png",
    altKey: "authShotResearch" as const,
    className:
      "absolute start-[10%] bottom-[6%] z-30 w-[55%] rotate-[1.5deg] shadow-2xl shadow-stone-900/25",
  },
  {
    src: "/screenshots/draft-approval.png",
    altKey: "authShotApproval" as const,
    className:
      "absolute end-[6%] bottom-[10%] z-[15] w-[48%] rotate-[-4deg] shadow-xl shadow-stone-900/20",
  },
] as const;

export async function WorkspaceScreenshots() {
  const { t } = await getRequestI18n();

  return (
    <div className="relative hidden min-h-full overflow-hidden lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(31,61,43,0.18),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(28,25,23,0.1),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -start-24 top-1/4 h-72 w-72 rounded-full bg-[var(--accent)]/10 blur-3xl"
      />

      <div className="relative z-10 px-10 pt-12 xl:px-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">
          {t.brand}
        </p>
        <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight text-stone-900 xl:text-4xl">
          {t.authShowcaseTitle}
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
          {t.authShowcaseBody}
        </p>
      </div>

      <div className="relative mx-auto mt-8 h-[min(62vh,520px)] w-full max-w-3xl flex-1 px-6 pb-10 xl:px-10">
        {SHOTS.map((shot) => (
          <div
            key={shot.src}
            className={`${shot.className} overflow-hidden rounded-xl border border-stone-200/80 bg-[var(--panel)] ring-1 ring-stone-900/5`}
          >
            <Image
              src={shot.src}
              alt={t[shot.altKey]}
              width={1440}
              height={900}
              className="h-auto w-full"
              sizes="(min-width: 1024px) 40vw, 0px"
              priority
            />
          </div>
        ))}
      </div>
    </div>
  );
}
