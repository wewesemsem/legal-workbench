import { NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/api";
import { getEnv } from "@/lib/env";
import {
  expiredVerificationTokenError,
  invalidVerificationTokenError,
  verifyEmailToken,
} from "@/modules/auth/email-verification";
import { verifyEmailSchema } from "@/modules/auth/schemas";
import { logAuthEvent } from "@/modules/auth/service";

function redirectWithStatus(
  status: "success" | "already_verified" | "expired" | "invalid",
) {
  const env = getEnv();
  const url = new URL("/verified", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    verifyEmailSchema.parse({ token });
    const result = await verifyEmailToken(token);

    logAuthEvent("verify_email_result", { status: result.status });

    if (result.status === "verified") {
      return redirectWithStatus("success");
    }
    if (result.status === "already_verified") {
      return redirectWithStatus("already_verified");
    }
    if (result.status === "expired") {
      return redirectWithStatus("expired");
    }
    return redirectWithStatus("invalid");
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = verifyEmailSchema.parse(body);
    const result = await verifyEmailToken(input.token);

    logAuthEvent("verify_email_result", { status: result.status });

    if (result.status === "verified") {
      return jsonOk({
        status: result.status,
        message: "Email verified successfully. A welcome email is on its way.",
      });
    }

    if (result.status === "already_verified") {
      return jsonOk({
        status: result.status,
        message: "This email is already verified. You can sign in.",
      });
    }

    if (result.status === "expired") {
      throw expiredVerificationTokenError();
    }

    throw invalidVerificationTokenError();
  } catch (error) {
    return jsonError(error);
  }
}
