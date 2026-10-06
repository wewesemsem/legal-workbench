"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

import { loginRequest } from "@/modules/auth/client";
import { useI18n } from "@/modules/i18n/provider";

export function LoginForm() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      await loginRequest({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      const next = searchParams.get("next");
      const destination = next && next.startsWith("/") ? next : "/app";
      // Full page load so the new session cookie is visible to proxy/middleware.
      window.location.href = destination;
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginFailed);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">{t.email}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@firm.com"
          className="auth-input"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">{t.password}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="auth-input"
        />
      </label>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full"
      >
        {pending ? t.signingIn : t.signIn}
      </button>
    </form>
  );
}
