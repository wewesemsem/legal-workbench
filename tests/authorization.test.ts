import { beforeEach, describe, expect, it } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyGet } from "@/app/api/auth/verify-email/route";
import { GET as userGet } from "@/app/api/users/[userId]/route";
import {
  assertSameUser,
  canLawyerManageWorkspaces,
  requireRole,
  type AuthContext,
} from "@/modules/authorization";

import {
  STRONG_PASSWORD,
  cleanupUserByEmail,
  collectCookies,
  extractVerificationTokenFromEmail,
  resetTestState,
  uniqueEmail,
} from "./helpers";

async function registerVerifyLogin(email: string, role: "LAWYER" | "CLIENT") {
  await registerPost(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.1",
      },
      body: JSON.stringify({
        email,
        password: STRONG_PASSWORD,
        firstName: "Owner",
        lastName: "One",
        role,
      }),
    }),
  );

  const token = extractVerificationTokenFromEmail(email);
  await verifyGet(
    new Request(`http://localhost/api/auth/verify-email?token=${token}`),
  );

  const login = await loginPost(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.2",
      },
      body: JSON.stringify({
        email,
        password: STRONG_PASSWORD,
      }),
    }),
  );

  const body = await login.json();
  return { cookie: collectCookies(login), user: body.user };
}

describe("authorization", () => {
  beforeEach(() => {
    resetTestState();
  });

  it("identifies lawyer and client roles", () => {
    const lawyer: AuthContext = {
      userId: "1",
      email: "a@example.com",
      role: "LAWYER",
      firstName: "A",
      lastName: "B",
    };
    const client: AuthContext = {
      userId: "2",
      email: "b@example.com",
      role: "CLIENT",
      firstName: "C",
      lastName: "D",
    };

    expect(() => requireRole(lawyer, ["LAWYER"])).not.toThrow();
    expect(() => requireRole(client, ["LAWYER"])).toThrowError(/not authorized/);
    expect(canLawyerManageWorkspaces("LAWYER")).toBe(true);
    expect(canLawyerManageWorkspaces("CLIENT")).toBe(false);
  });

  it("allows a user to access their own account and blocks other users", async () => {
    const emailA = uniqueEmail("owner");
    const emailB = uniqueEmail("other");

    const userA = await registerVerifyLogin(emailA, "LAWYER");
    const userB = await registerVerifyLogin(emailB, "CLIENT");

    const own = await userGet(
      new Request(`http://localhost/api/users/${userA.user.id}`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ userId: userA.user.id }) },
    );
    expect(own.status).toBe(200);

    const other = await userGet(
      new Request(`http://localhost/api/users/${userB.user.id}`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ userId: userB.user.id }) },
    );
    expect(other.status).toBe(403);

    expect(() =>
      assertSameUser(
        {
          userId: userA.user.id,
          email: emailA,
          role: "LAWYER",
          firstName: "Owner",
          lastName: "One",
        },
        userB.user.id,
      ),
    ).toThrowError(/another user's resources/);

    await cleanupUserByEmail(emailA);
    await cleanupUserByEmail(emailB);
  });
});
