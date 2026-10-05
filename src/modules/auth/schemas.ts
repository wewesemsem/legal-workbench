import { z } from "zod";

import { passwordSchema } from "@/modules/auth/password";
import { USER_ROLES } from "@/modules/users/types";

export const registerSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: passwordSchema,
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  role: z.enum(USER_ROLES, {
    message: "Role must be LAWYER or CLIENT",
  }),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required").max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(128),
  newPassword: passwordSchema,
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
