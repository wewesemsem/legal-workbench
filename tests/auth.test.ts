import { beforeEach, describe, expect, it } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyGet } from "@/app/api/auth/verify-email/route";
import { GET as userGet } from "@/app/api/users/[userId]/route";

import {
  STRONG_PASSWORD,
  cleanupUserByEmail,
  collectCookies,
  extractVerificationTokenFromEmail,
  resetTestState,
  uniqueEmail,
} from "./helpers";

async function registerAndVerify(email: string, role: "LAWYER" | "CLIENT" = "LAWYER") {
  const register = await registerPost(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        email,
        password: STRONG_PASSWORD,
        firstName: "Amina",
        lastName: "Hassan",
        role,
      }),
    }),
  );
  expect(register.status).toBe(201);

  const token = extractVerificationTokenFromEmail(email);
  const verified = await verifyGet(
    new Request(`http://localhost/api/auth/verify-email?token=${token}`),
  );
  expect(verified.status).toBe(307);

  const login = await loginPost(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.11",
      },
      body: JSON.stringify({
        email,
        password: STRONG_PASSWORD,
      }),
    }),
  );
  expect(login.status).toBe(200);
  return { register, login, cookie: collectCookies(login) };
}

describe("authentication", () => {
  beforeEach(() => {
    resetTestState();
  });

  it("registers a lawyer successfully without auto-login", async () => {
    const email = uniqueEmail("lawyer");
    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
          firstName: "Amina",
          lastName: "Hassan",
          role: "LAWYER",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe(email.toLowerCase());
    expect(body.user.role).toBe("LAWYER");
    expect(body.user.emailVerified).toBe(false);
    expect(body.user.password).toBeUndefined();
    expect(body.verificationEmailSent).toBe(true);
    expect(collectCookies(response)).not.toContain("session_token");

    await cleanupUserByEmail(email);
  });

  it("rejects duplicate registration", async () => {
    const email = uniqueEmail("dup");
    const payload = {
      email,
      password: STRONG_PASSWORD,
      firstName: "Omar",
      lastName: "Said",
      role: "CLIENT" as const,
    };

    const first = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.11",
        },
        body: JSON.stringify(payload),
      }),
    );
    expect(first.status).toBe(201);

    const second = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.12",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error.code).toBe("CONFLICT");

    await cleanupUserByEmail(email);
  });

  it("logs in with valid credentials after verification and fails with invalid ones", async () => {
    const email = uniqueEmail("login");
    await registerAndVerify(email);

    const badLogin = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.14",
        },
        body: JSON.stringify({
          email,
          password: "WrongPass123!",
        }),
      }),
    );
    expect(badLogin.status).toBe(401);

    await cleanupUserByEmail(email);
  });

  it("supports logout and rejects unauthenticated /me", async () => {
    const email = uniqueEmail("logout");
    const { cookie } = await registerAndVerify(email, "CLIENT");

    const me = await meGet(
      new Request("http://localhost/api/auth/me", {
        headers: { cookie },
      }),
    );
    expect(me.status).toBe(200);
    const meBody = await me.json();
    expect(meBody.user.role).toBe("CLIENT");
    expect(meBody.user.emailVerified).toBe(true);

    const logout = await logoutPost(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie },
      }),
    );
    expect(logout.status).toBe(200);
    const logoutCookies = collectCookies(logout);
    const cookieAfterLogout = logoutCookies || cookie;

    const meAfter = await meGet(
      new Request("http://localhost/api/auth/me", {
        headers: { cookie: cookieAfterLogout },
      }),
    );
    expect(meAfter.status).toBe(401);

    const unauthenticatedUser = await userGet(
      new Request("http://localhost/api/users/someone"),
      { params: Promise.resolve({ userId: "someone" }) },
    );
    expect(unauthenticatedUser.status).toBe(401);

    await cleanupUserByEmail(email);
  });
});
