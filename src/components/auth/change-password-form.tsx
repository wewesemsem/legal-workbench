"use client";

import { FormEvent, useState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { changePasswordRequest } from "@/modules/auth/client";
import { getPasswordValidationErrors } from "@/modules/auth/password";

export function ChangePasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const passwordErrors = getPasswordValidationErrors(newPassword);

    if (passwordErrors.length > 0) {
      setError(passwordErrors.join(". "));
      setPending(false);
      return;
    }

    try {
      const result = await changePasswordRequest({
        currentPassword,
        newPassword,
      });
      setMessage(result.message);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">
          Current password
        </span>
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Current password"
          className="auth-input"
        />
      </label>

      <PasswordField
        name="newPassword"
        label="New password"
        autoComplete="new-password"
      />

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
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
