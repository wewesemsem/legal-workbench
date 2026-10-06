import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getRequestI18n } from "@/modules/i18n/server";

export default async function LoginPage() {
  const { t } = await getRequestI18n();

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold text-stone-900">{t.loginTitle}</h1>
      <p className="mt-2 text-sm text-stone-600">{t.loginSubtitle}</p>
      <div className="mt-6">
        <Suspense
          fallback={<p className="text-sm text-stone-500">{t.signingIn}</p>}
        >
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-stone-600">
        {t.noAccount}{" "}
        <Link href="/register" className="font-medium text-stone-900 underline">
          {t.register}
        </Link>
      </p>
      <p className="mt-2 text-sm text-stone-600">
        {t.needConfirm}{" "}
        <Link
          href="/verify-email"
          className="font-medium text-stone-900 underline"
        >
          {t.resendConfirmation}
        </Link>
      </p>
    </AuthShell>
  );
}
