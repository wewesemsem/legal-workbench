import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";
import { getRequestI18n } from "@/modules/i18n/server";

export default async function RegisterPage() {
  const { t } = await getRequestI18n();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-stone-200 bg-[var(--panel)] p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-stone-900">
          {t.registerTitle}
        </h1>
        <p className="mt-2 text-sm text-stone-600">{t.registerSubtitle}</p>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-sm text-stone-600">
          {t.alreadyRegistered}{" "}
          <Link href="/login" className="font-medium text-stone-900 underline">
            {t.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
