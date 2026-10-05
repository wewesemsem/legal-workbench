import { describe, expect, it } from "vitest";

import { POST as registerPost } from "@/app/api/auth/register/route";
import {
  getPasswordValidationErrors,
  isPasswordValid,
  passwordSchema,
} from "@/modules/auth/password";

import { cleanupUserByEmail, resetTestState, uniqueEmail } from "./helpers";

describe("password rules", () => {
  it("accepts strong passwords and rejects weak ones", () => {
    expect(isPasswordValid("SecurePass123!")).toBe(true);
    expect(getPasswordValidationErrors("short")).toEqual(
      expect.arrayContaining([
        "At least 8 characters",
        "At least one uppercase letter",
        "At least one number",
        "At least one special character",
      ]),
    );
    expect(isPasswordValid("alllowercase1!")).toBe(false);
    expect(isPasswordValid("ALLUPPERCASE1!")).toBe(false);
    expect(isPasswordValid("NoNumber!")).toBe(false);
    expect(isPasswordValid("NoSpecial1")).toBe(false);
    expect(passwordSchema.safeParse("SecurePass123!").success).toBe(true);
    expect(passwordSchema.safeParse("weak").success).toBe(false);
  });

  it("rejects weak passwords on the registration API", async () => {
    resetTestState();
    const email = uniqueEmail("weakpass");
    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.50",
        },
        body: JSON.stringify({
          email,
          password: "Password1",
          firstName: "Weak",
          lastName: "Pass",
          role: "LAWYER",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body)).toMatch(/special character/i);

    await cleanupUserByEmail(email);
  });
});
