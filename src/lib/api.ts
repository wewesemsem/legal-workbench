import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/modules/authorization/errors";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 201, ...init });
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  console.error("[api] unexpected error", {
    name: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : "unknown",
  });

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 },
  );
}

/** Forward Set-Cookie headers from Better Auth responses onto our API response. */
export function withAuthCookies(target: NextResponse, source: Response) {
  const cookies = source.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    target.headers.append("set-cookie", cookie);
  }

  // Fallback for runtimes without getSetCookie
  if (cookies.length === 0) {
    const single = source.headers.get("set-cookie");
    if (single) {
      target.headers.append("set-cookie", single);
    }
  }

  return target;
}
