import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  AppError,
  conflict,
  forbidden,
  rateLimited,
  unauthenticated,
  validationError,
} from "@/modules/authorization/errors";
import type { AuthContext } from "@/modules/authorization/permissions";
import { auth } from "@/modules/auth/auth";
import { issueEmailVerification } from "@/modules/auth/email-verification";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from "@/modules/auth/schemas";
import { isUserRole, type PublicUser } from "@/modules/users/types";

function toPublicUser(user: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  emailVerified?: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): PublicUser {
  if (!isUserRole(user.role)) {
    throw new AppError(
      "FORBIDDEN",
      "User role is invalid or unsupported",
      500,
    );
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    role: user.role,
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapAuthError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof APIError) {
    const status = error.statusCode ?? 400;
    const message = error.message || "Authentication request failed";

    if (status === 401 || status === 403) {
      if (/email/i.test(message) && /verif/i.test(message)) {
        return forbidden(
          "Please verify your email before signing in. Check your inbox for a confirmation link.",
        );
      }
      return unauthenticated("Invalid email or password");
    }

    if (status === 422 || status === 400) {
      if (/already exists|unique|registered/i.test(message)) {
        return conflict("An account with this email already exists");
      }
      if (/password/i.test(message)) {
        return validationError(message);
      }
      return validationError(message);
    }

    if (status === 429) {
      return rateLimited();
    }

    return new AppError("VALIDATION_ERROR", message, status);
  }

  if (error instanceof Error) {
    if (/already exists|unique|duplicate/i.test(error.message)) {
      return conflict("An account with this email already exists");
    }
  }

  return new AppError("VALIDATION_ERROR", "Authentication request failed", 400);
}

function enforceAuthRateLimit(
  request: Request,
  action: "register" | "login" | "change-password",
) {
  const env = getEnv();
  const ip = getClientIp(request.headers);
  const result = checkRateLimit(
    `${action}:${ip}`,
    env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    env.AUTH_RATE_LIMIT_WINDOW_MS,
  );

  if (!result.allowed) {
    throw rateLimited();
  }

  return result;
}

export async function registerUser(input: RegisterInput, request: Request) {
  enforceAuthRateLimit(request, "register");

  const email = input.email.toLowerCase();

  try {
    // Better Auth returns a synthetic success for duplicates when autoSignIn is
    // disabled; enforce uniqueness explicitly for a clear API conflict response.
    const existing = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    if (existing[0]) {
      throw conflict("An account with this email already exists");
    }

    const result = await auth.api.signUpEmail({
      body: {
        email,
        password: input.password,
        name: `${input.firstName} ${input.lastName}`.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!result.ok) {
      const payload = (await result.json().catch(() => null)) as {
        message?: string;
      } | null;
      const message = payload?.message ?? "Registration failed";
      if (/already exists|unique|registered/i.test(message)) {
        throw conflict("An account with this email already exists");
      }
      throw validationError(message);
    }

    const payload = (await result.json()) as {
      user: {
        id: string;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
        role?: string | null;
        emailVerified?: boolean | null;
        createdAt: Date | string;
        updatedAt: Date | string;
      };
    };

    // Guard against Better Auth synthetic duplicate responses.
    const persisted = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, payload.user.id))
      .limit(1);

    if (!persisted[0]) {
      throw conflict("An account with this email already exists");
    }

    const user = toPublicUser(payload.user);

    await issueEmailVerification({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });

    return {
      user,
      // No session cookies when autoSignIn is disabled.
      response: result,
      verificationEmailSent: true as const,
    };
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function loginUser(input: LoginInput, request: Request) {
  enforceAuthRateLimit(request, "login");

  const email = input.email.toLowerCase();

  try {
    const existing = await db
      .select({
        emailVerified: userTable.emailVerified,
      })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    if (existing[0] && !existing[0].emailVerified) {
      throw forbidden(
        "Please verify your email before signing in. Check your inbox for a confirmation link.",
      );
    }

    const result = await auth.api.signInEmail({
      body: {
        email,
        password: input.password,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!result.ok) {
      throw unauthenticated("Invalid email or password");
    }

    const payload = (await result.json()) as {
      user: {
        id: string;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
        role?: string | null;
        emailVerified?: boolean | null;
        createdAt: Date | string;
        updatedAt: Date | string;
      };
    };

    const user = toPublicUser(payload.user);
    if (!user.emailVerified) {
      throw forbidden(
        "Please verify your email before signing in. Check your inbox for a confirmation link.",
      );
    }

    return {
      user,
      response: result,
    };
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function changePassword(
  input: ChangePasswordInput,
  request: Request,
) {
  enforceAuthRateLimit(request, "change-password");

  try {
    const result = await auth.api.changePassword({
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: true,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!result.ok) {
      throw unauthenticated("Current password is incorrect");
    }

    return { response: result };
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function logoutUser(request: Request) {
  const result = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  return { response: result };
}

export async function getSessionUser(
  request: Request,
): Promise<PublicUser | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return null;
  }

  return toPublicUser(session.user);
}

export async function requireAuthContext(
  request: Request,
): Promise<AuthContext> {
  const user = await getSessionUser(request);
  if (!user) {
    throw unauthenticated();
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

/**
 * Safe logger helper — never log passwords, tokens, or secrets.
 */
export function logAuthEvent(
  event: string,
  details: Record<string, unknown> = {},
) {
  const safe = { ...details };
  for (const key of Object.keys(safe)) {
    if (/password|secret|token|authorization|cookie/i.test(key)) {
      safe[key] = "[redacted]";
    }
  }
  console.info(`[auth] ${event}`, safe);
}
