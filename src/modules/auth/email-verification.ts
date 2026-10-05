import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { user as userTable, verification } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  conflict,
  rateLimited,
  validationError,
} from "@/modules/authorization/errors";
import {
  sendEmailVerificationMessage,
  sendWelcomeMessage,
} from "@/modules/email/service";

const VERIFY_IDENTIFIER_PREFIX = "email-verification:";

function verificationIdentifier(email: string) {
  return `${VERIFY_IDENTIFIER_PREFIX}${email.toLowerCase()}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createRawToken() {
  return randomBytes(32).toString("base64url");
}

async function invalidateExistingTokens(email: string) {
  await db
    .delete(verification)
    .where(eq(verification.identifier, verificationIdentifier(email)));
}

export async function issueEmailVerification(input: {
  userId: string;
  email: string;
  firstName: string;
}) {
  const env = getEnv();
  const email = input.email.toLowerCase();
  const token = createRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_EXPIRES_MS);

  await invalidateExistingTokens(email);

  await db.insert(verification).values({
    id: randomBytes(16).toString("hex"),
    identifier: verificationIdentifier(email),
    value: tokenHash,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const verifyUrl = new URL("/api/auth/verify-email", env.NEXT_PUBLIC_APP_URL);
  verifyUrl.searchParams.set("token", token);

  await sendEmailVerificationMessage({
    to: email,
    firstName: input.firstName,
    verifyUrl: verifyUrl.toString(),
  });

  return { expiresAt };
}

export async function resendEmailVerification(
  emailInput: string,
  request: Request,
) {
  const env = getEnv();
  const email = emailInput.trim().toLowerCase();
  const ip = getClientIp(request.headers);
  const limited = checkRateLimit(
    `resend-verification:${ip}:${email}`,
    env.EMAIL_RESEND_RATE_LIMIT_MAX_ATTEMPTS,
    env.EMAIL_RESEND_RATE_LIMIT_WINDOW_MS,
  );

  if (!limited.allowed) {
    throw rateLimited(
      "Too many verification email requests. Please try again later.",
    );
  }

  const rows = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      firstName: userTable.firstName,
      emailVerified: userTable.emailVerified,
    })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  const user = rows[0];

  // Avoid account enumeration: always return a generic success to the client.
  if (!user) {
    return { sent: true as const };
  }

  if (user.emailVerified) {
    return { sent: true as const, alreadyVerified: true as const };
  }

  await issueEmailVerification({
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
  });

  return { sent: true as const };
}

export type VerifyEmailResult =
  | { status: "verified"; email: string; firstName: string }
  | { status: "already_verified"; email: string; firstName: string }
  | { status: "invalid" }
  | { status: "expired" };

export async function verifyEmailToken(rawToken: string): Promise<VerifyEmailResult> {
  if (!rawToken || rawToken.length < 20) {
    return { status: "invalid" };
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const rows = await db
    .select()
    .from(verification)
    .where(
      and(
        eq(verification.value, tokenHash),
        gt(verification.expiresAt, now),
      ),
    )
    .limit(1);

  const record = rows[0];

  if (!record) {
    // Distinguish expired vs invalid when possible (without leaking emails).
    const expiredRows = await db
      .select()
      .from(verification)
      .where(eq(verification.value, tokenHash))
      .limit(1);

    if (expiredRows[0]) {
      await db.delete(verification).where(eq(verification.id, expiredRows[0].id));
      return { status: "expired" };
    }

    return { status: "invalid" };
  }

  if (!record.identifier.startsWith(VERIFY_IDENTIFIER_PREFIX)) {
    return { status: "invalid" };
  }

  const email = record.identifier.slice(VERIFY_IDENTIFIER_PREFIX.length);
  const users = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      firstName: userTable.firstName,
      emailVerified: userTable.emailVerified,
    })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  const user = users[0];
  if (!user) {
    await db.delete(verification).where(eq(verification.id, record.id));
    return { status: "invalid" };
  }

  // Consume token immediately to enforce single-use.
  await db.delete(verification).where(eq(verification.id, record.id));
  await invalidateExistingTokens(email);

  if (user.emailVerified) {
    return {
      status: "already_verified",
      email: user.email,
      firstName: user.firstName,
    };
  }

  await db
    .update(userTable)
    .set({
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, user.id));

  await sendWelcomeMessage({
    to: user.email,
    firstName: user.firstName,
  });

  return {
    status: "verified",
    email: user.email,
    firstName: user.firstName,
  };
}

export function assertNotAlreadyVerifiedForChange(emailVerified: boolean) {
  if (emailVerified) {
    throw conflict("Email is already verified");
  }
}

export function invalidVerificationTokenError() {
  return validationError("This verification link is invalid or has already been used.");
}

export function expiredVerificationTokenError() {
  return validationError(
    "This verification link has expired. Request a new confirmation email.",
  );
}
