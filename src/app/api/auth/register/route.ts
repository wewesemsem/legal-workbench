import { jsonCreated, jsonError } from "@/lib/api";
import { registerSchema } from "@/modules/auth/schemas";
import { logAuthEvent, registerUser } from "@/modules/auth/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);
    const { user, verificationEmailSent } = await registerUser(input, request);

    logAuthEvent("register_success", {
      userId: user.id,
      role: user.role,
      verificationEmailSent,
    });

    return jsonCreated({
      user,
      verificationEmailSent,
      message:
        "Account created. Please check your email to confirm your address before signing in.",
    });
  } catch (error) {
    logAuthEvent("register_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return jsonError(error);
  }
}
