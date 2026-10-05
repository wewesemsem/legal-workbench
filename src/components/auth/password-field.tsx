"use client";

import { useMemo, useState } from "react";

import {
  evaluatePasswordRules,
  isPasswordValid,
} from "@/modules/auth/password";

type PasswordFieldProps = {
  name?: string;
  label?: string;
  autoComplete?: string;
  showRules?: boolean;
  onValidityChange?: (valid: boolean) => void;
};

export function PasswordField({
  name = "password",
  label = "Password",
  autoComplete = "new-password",
  showRules = true,
  onValidityChange,
}: PasswordFieldProps) {
  const [password, setPassword] = useState("");
  const rules = useMemo(() => evaluatePasswordRules(password), [password]);

  return (
    <div className="space-y-2">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        <input
          name={name}
          type="password"
          required
          autoComplete={autoComplete}
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => {
            const next = event.target.value;
            setPassword(next);
            onValidityChange?.(isPasswordValid(next));
          }}
          className="auth-input"
        />
      </label>

      {showRules ? (
        <ul className="space-y-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={rule.passed ? "text-emerald-700" : "text-stone-500"}
            >
              {rule.passed ? "✓" : "•"} {rule.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
