import { jsonError, jsonOk } from "@/lib/api";
import { resendEmailVerification } from "@/modules/auth/email-verification";
import { resendVerificationSchema } from "@/modules/auth/schemas";
import { logAuthEvent } from "@/modules/auth/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = resendVerificationSchema.parse(body);
    const result = await resendEmailVerification(input.email, request);

    logAuthEvent("resend_verification", {
      alreadyVerified: Boolean(result.alreadyVerified),
    });

    return jsonOk({
      sent: true,
      message:
        "If an unverified account exists for that email, a new confirmation link has been sent.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
