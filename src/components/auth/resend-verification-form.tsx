"use client";

import { FormEvent, useState } from "react";

import { resendVerificationRequest } from "@/modules/auth/client";

type ResendVerificationFormProps = {
  defaultEmail?: string;
};

export function ResendVerificationForm({
  defaultEmail = "",
}: ResendVerificationFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      const result = await resendVerificationRequest(
        String(form.get("email") ?? ""),
      );
      setMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to resend verification email",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">Email</span>
        <input
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          autoComplete="email"
          placeholder="you@firm.com"
          className="auth-input"
        />
      </label>

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Resend confirmation email"}
      </button>
    </form>
  );
}
