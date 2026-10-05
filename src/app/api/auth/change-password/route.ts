import { jsonError, jsonOk, withAuthCookies } from "@/lib/api";
import { changePasswordSchema } from "@/modules/auth/schemas";
import {
  changePassword,
  logAuthEvent,
  requireAuthContext,
} from "@/modules/auth/service";

export async function POST(request: Request) {
  try {
    await requireAuthContext(request);
    const body = await request.json();
    const input = changePasswordSchema.parse(body);
    const { response } = await changePassword(input, request);

    logAuthEvent("change_password_success");

    return withAuthCookies(
      jsonOk({
        success: true,
        message: "Password updated successfully.",
      }),
      response,
    );
  } catch (error) {
    logAuthEvent("change_password_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return jsonError(error);
  }
}
