import Link from "next/link";

import { WorkspaceScreenshots } from "@/components/auth/workspace-screenshots";
import { getRequestI18n } from "@/modules/i18n/server";

export default async function HomePage() {
  const { t } = await getRequestI18n();

  return (
    <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
      <aside className="relative hidden min-h-[calc(100vh-3.5rem)] overflow-hidden border-e border-stone-200/80 bg-[var(--sidebar)] lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(31,61,43,0.16),transparent_50%),radial-gradient(ellipse_at_90%_90%,rgba(28,25,23,0.08),transparent_45%)]"
        />
        <div className="relative h-full">
          <WorkspaceScreenshots />
        </div>
      </aside>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <WorkspaceScreenshots compact />
          </div>

          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">
              {t.landingEyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              {t.landingTitle}
            </h1>
            <p className="mt-4 text-lg text-stone-600">{t.landingBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary">
                {t.createAccount}
              </Link>
              <Link href="/login" className="btn-secondary">
                {t.signIn}
              </Link>
              <Link
                href="/app"
                className="rounded-md border border-transparent px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900"
              >
                {t.openWorkspace}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
