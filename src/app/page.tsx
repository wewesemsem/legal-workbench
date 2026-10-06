import Link from "next/link";

import { getRequestI18n } from "@/modules/i18n/server";

export default async function HomePage() {
  const { t } = await getRequestI18n();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">
        {t.landingEyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
        {t.landingTitle}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-stone-600">{t.landingBody}</p>
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
    </main>
  );
}
