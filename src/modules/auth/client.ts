"use client";

import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from "@/modules/auth/schemas";
import type { PublicUser } from "@/modules/users/types";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ path: string; message: string }>;
  };
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function registerRequest(input: RegisterInput) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });

  const data = await parseJson<
    {
      user?: PublicUser;
      verificationEmailSent?: boolean;
      message?: string;
    } & ApiErrorBody
  >(response);

  if (!response.ok || !data.user) {
    const detailMessage = data.error?.details?.map((d) => d.message).join(". ");
    throw new Error(
      detailMessage || data.error?.message || "Registration failed",
    );
  }

  return data.user;
}

export async function loginRequest(input: LoginInput) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });

  const data = await parseJson<{ user?: PublicUser } & ApiErrorBody>(response);
  if (!response.ok || !data.user) {
    throw new Error(data.error?.message ?? "Login failed");
  }

  return data.user;
}

export async function logoutRequest() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const data = await parseJson<ApiErrorBody>(response);
    throw new Error(data.error?.message ?? "Logout failed");
  }
}

export async function meRequest() {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
  });

  const data = await parseJson<{ user?: PublicUser } & ApiErrorBody>(response);
  if (!response.ok || !data.user) {
    return null;
  }

  return data.user;
}

export async function resendVerificationRequest(email: string) {
  const response = await fetch("/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await parseJson<{ message?: string } & ApiErrorBody>(response);
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Unable to resend verification email");
  }

  return {
    message:
      data.message ??
      "If an unverified account exists for that email, a new confirmation link has been sent.",
  };
}

export async function changePasswordRequest(input: ChangePasswordInput) {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });

  const data = await parseJson<{ message?: string } & ApiErrorBody>(response);
  if (!response.ok) {
    const detailMessage = data.error?.details?.map((d) => d.message).join(". ");
    throw new Error(
      detailMessage || data.error?.message || "Unable to change password",
    );
  }

  return {
    message: data.message ?? "Password updated successfully.",
  };
}
