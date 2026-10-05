import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "At least one number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "At least one special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function evaluatePasswordRules(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }));
}

export function getPasswordValidationErrors(password: string): string[] {
  return evaluatePasswordRules(password)
    .filter((rule) => !rule.passed)
    .map((rule) => rule.label);
}

export function isPasswordValid(password: string): boolean {
  return getPasswordValidationErrors(password).length === 0;
}

/**
 * Shared Zod password schema used by registration and password-change APIs.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .superRefine((value, ctx) => {
    for (const error of getPasswordValidationErrors(value)) {
      // Avoid duplicating the min-length message already covered above.
      if (error.startsWith("At least 8 characters")) {
        continue;
      }
      ctx.addIssue({
        code: "custom",
        message: error,
      });
    }
  });
