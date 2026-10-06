"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordField } from "@/components/auth/password-field";
import { registerRequest } from "@/modules/auth/client";
import { getPasswordValidationErrors } from "@/modules/auth/password";
import { useI18n } from "@/modules/i18n/provider";
import type { UserRole } from "@/modules/users/types";

export function RegisterForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordErrors = getPasswordValidationErrors(password);

    if (passwordErrors.length > 0) {
      setError(passwordErrors.join(". "));
      setPending(false);
      return;
    }

    try {
      const email = String(form.get("email") ?? "");
      const result = await registerRequest({
        email,
        password,
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        role: String(form.get("role") ?? "LAWYER") as UserRole,
      });
      if (result.verificationEmailSent) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        router.push("/login");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.createAccount);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-stone-700">{t.firstName}</span>
          <input
            name="firstName"
            required
            autoComplete="given-name"
            className="auth-input"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-stone-700">{t.lastName}</span>
          <input
            name="lastName"
            required
            autoComplete="family-name"
            className="auth-input"
          />
        </label>
      </div>

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

      <PasswordField name="password" label={t.password} />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">{t.role}</span>
        <select name="role" defaultValue="LAWYER" className="auth-select">
          <option value="LAWYER">{t.lawyer}</option>
          <option value="CLIENT">{t.client}</option>
        </select>
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
        {pending ? t.creatingAccount : t.createAccount}
      </button>
    </form>
  );
}
