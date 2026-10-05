import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyGet } from "@/app/api/auth/verify-email/route";
import { checkRateLimit, resetRateLimitStoreForTests } from "@/lib/rate-limit";
import { logAuthEvent } from "@/modules/auth/service";

import {
  STRONG_PASSWORD,
  cleanupUserByEmail,
  extractVerificationTokenFromEmail,
  resetTestState,
  uniqueEmail,
} from "./helpers";

describe("security", () => {
  beforeEach(() => {
    resetTestState();
  });

  it("never returns password fields from auth APIs", async () => {
    const email = uniqueEmail("secure");
    const register = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.1",
        },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
          firstName: "Secure",
          lastName: "User",
          role: "LAWYER",
        }),
      }),
    );
    const registerBody = await register.json();
    expect(JSON.stringify(registerBody)).not.toMatch(/SecurePass123!/);
    expect(registerBody.user.password).toBeUndefined();

    const token = extractVerificationTokenFromEmail(email);
    await verifyGet(
      new Request(`http://localhost/api/auth/verify-email?token=${token}`),
    );

    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.2",
        },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
        }),
      }),
    );
    const loginBody = await login.json();
    expect(JSON.stringify(loginBody)).not.toMatch(/SecurePass123!/);
    expect(loginBody.user.password).toBeUndefined();

    await cleanupUserByEmail(email);
  });

  it("rejects malformed authentication input", async () => {
    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.3",
        },
        body: JSON.stringify({
          email: "not-an-email",
          password: "short",
          firstName: "",
          lastName: "",
          role: "ADMIN",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("redacts sensitive fields from auth logs", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logAuthEvent("test_event", {
      userId: "abc",
      password: "super-secret",
      token: "session-token",
    });

    expect(spy).toHaveBeenCalled();
    const logged = spy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(logged.password).toBe("[redacted]");
    expect(logged.token).toBe("[redacted]");
    expect(logged.userId).toBe("abc");
    spy.mockRestore();
  });

  it("rate limits repeated auth attempts from the same key", () => {
    resetRateLimitStoreForTests();
    for (let i = 0; i < 10; i += 1) {
      const result = checkRateLimit("login:192.0.2.9", 10, 60_000);
      expect(result.allowed).toBe(true);
    }
    const blocked = checkRateLimit("login:192.0.2.9", 10, 60_000);
    expect(blocked.allowed).toBe(false);
  });
});
