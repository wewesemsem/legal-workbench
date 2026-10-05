import Link from "next/link";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { getRequestI18n } from "@/modules/i18n/server";

type VerifyEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const email = params.email ?? "";
  const { t } = await getRequestI18n();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-stone-200 bg-[var(--panel)] p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.18em] text-stone-500">
          {t.verifyEyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          {t.verifyTitle}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {t.verifyBodyBefore}{" "}
          {email ? (
            <span className="font-medium text-stone-900">{email}</span>
          ) : (
            t.verifyBodyInbox
          )}
          {t.verifyBodyAfter}
        </p>

        <div className="mt-8 border-t border-stone-200 pt-6">
          <h2 className="text-sm font-medium text-stone-900">{t.needNewLink}</h2>
          <p className="mt-1 text-sm text-stone-600">{t.needNewLinkBody}</p>
          <div className="mt-4">
            <ResendVerificationForm defaultEmail={email} />
          </div>
        </div>

        <p className="mt-6 text-sm text-stone-600">
          {t.alreadyVerified}{" "}
          <Link href="/login" className="font-medium text-stone-900 underline">
            {t.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
