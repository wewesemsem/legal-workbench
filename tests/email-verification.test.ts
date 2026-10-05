import { beforeEach, describe, expect, it } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as resendPost } from "@/app/api/auth/resend-verification/route";
import {
  GET as verifyGet,
  POST as verifyPost,
} from "@/app/api/auth/verify-email/route";
import {
  findConsoleEmail,
  getConsoleSentEmails,
} from "@/modules/email/providers/console";

import {
  STRONG_PASSWORD,
  cleanupUserByEmail,
  extractVerificationTokenFromEmail,
  resetTestState,
  uniqueEmail,
} from "./helpers";

describe("email verification", () => {
  beforeEach(() => {
    resetTestState();
  });

  it("sends confirmation email on register and welcome email after verify", async () => {
    const email = uniqueEmail("verifyflow");

    const register = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.20",
        },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
          firstName: "Nour",
          lastName: "Ali",
          role: "LAWYER",
        }),
      }),
    );
    expect(register.status).toBe(201);
    expect(findConsoleEmail(email, "Confirm your Lawyer Workbench")).toBeTruthy();

    const blockedLogin = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.21",
        },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
        }),
      }),
    );
    expect([401, 403]).toContain(blockedLogin.status);

    const token = extractVerificationTokenFromEmail(email);
    const verify = await verifyGet(
      new Request(`http://localhost/api/auth/verify-email?token=${token}`),
    );
    expect(verify.status).toBe(307);
    expect(verify.headers.get("location")).toContain("/verified?status=success");

    expect(findConsoleEmail(email, "Welcome to Lawyer Workbench")).toBeTruthy();
    expect(
      getConsoleSentEmails().every(
        (message) => !message.text.includes(STRONG_PASSWORD),
      ),
    ).toBe(true);

    const reuse = await verifyPost(
      new Request("http://localhost/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(reuse.status).toBe(400);

    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.22",
        },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
        }),
      }),
    );
    expect(login.status).toBe(200);

    await cleanupUserByEmail(email);
  });

  it("allows resend and rate limits excessive resend requests", async () => {
    const email = uniqueEmail("resend");
    await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.30",
        },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
          firstName: "Sara",
          lastName: "Youssef",
          role: "CLIENT",
        }),
      }),
    );

    const firstToken = extractVerificationTokenFromEmail(email);

    const resend = await resendPost(
      new Request("http://localhost/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.31",
        },
        body: JSON.stringify({ email }),
      }),
    );
    expect(resend.status).toBe(200);

    const secondToken = extractVerificationTokenFromEmail(email);
    expect(secondToken).not.toBe(firstToken);

    // Old token should no longer work after resend invalidation.
    const oldVerify = await verifyPost(
      new Request("http://localhost/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: firstToken }),
      }),
    );
    expect(oldVerify.status).toBe(400);

    for (let i = 0; i < 3; i += 1) {
      const response = await resendPost(
        new Request("http://localhost/api/auth/resend-verification", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "198.51.100.31",
          },
          body: JSON.stringify({ email }),
        }),
      );
      if (i < 2) {
        expect(response.status).toBe(200);
      }
    }

    const limited = await resendPost(
      new Request("http://localhost/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.31",
        },
        body: JSON.stringify({ email }),
      }),
    );
    expect(limited.status).toBe(429);

    await cleanupUserByEmail(email);
  });

  it("handles invalid verification tokens gracefully", async () => {
    const response = await verifyPost(
      new Request("http://localhost/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "not-a-real-token-value-at-all" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
