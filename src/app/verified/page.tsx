import Link from "next/link";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

type VerifiedPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function VerifiedPage({ searchParams }: VerifiedPageProps) {
  const params = await searchParams;
  const status = params.status ?? "invalid";

  const copy = {
    success: {
      title: "Email confirmed",
      body: "Your email is verified and a welcome message is on its way. You can now sign in to Lawyer Workbench.",
      tone: "success" as const,
    },
    already_verified: {
      title: "Already verified",
      body: "This email was already confirmed. You can sign in to your account.",
      tone: "success" as const,
    },
    expired: {
      title: "Link expired",
      body: "This confirmation link has expired. Request a new verification email below.",
      tone: "error" as const,
    },
    invalid: {
      title: "Link invalid",
      body: "This confirmation link is invalid or has already been used. Request a new verification email below.",
      tone: "error" as const,
    },
  }[status] ?? {
    title: "Link invalid",
    body: "This confirmation link is invalid or has already been used.",
    tone: "error" as const,
  };

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-stone-200 bg-[var(--panel)] p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.18em] text-stone-500">
          Lawyer Workbench
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          {copy.title}
        </h1>
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm leading-6 ${
            copy.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {copy.body}
        </p>

        {copy.tone === "success" ? (
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
          >
            Sign in
          </Link>
        ) : (
          <div className="mt-6">
            <ResendVerificationForm />
          </div>
        )}
      </div>
    </main>
  );
}
