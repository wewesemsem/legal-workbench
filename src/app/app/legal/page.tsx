import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LegalResearchPanel } from "@/components/legal/legal-research-panel";
import { requireAuthContext } from "@/modules/auth/service";
import { getRequestI18n } from "@/modules/i18n/server";

export default async function LegalResearchPage() {
  const { t } = await getRequestI18n();
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });

  let context;
  try {
    context = await requireAuthContext(request);
  } catch {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 lg:py-10">
      <Link href="/app" className="text-sm text-stone-600 hover:text-stone-900">
        ← {t.home}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
        {t.publicLawResearch}
      </h1>
      <p className="mt-2 text-sm text-stone-600">{t.publicLawResearchBody}</p>
      <section className="mt-8 rounded-xl border border-stone-200 bg-[var(--panel)] p-6">
        <LegalResearchPanel allowDebug={context.role === "LAWYER"} />
      </section>
    </main>
  );
}
