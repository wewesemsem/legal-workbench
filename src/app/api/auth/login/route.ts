import { jsonError, jsonOk, withAuthCookies } from "@/lib/api";
import { loginSchema } from "@/modules/auth/schemas";
import { logAuthEvent, loginUser } from "@/modules/auth/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const { user, response } = await loginUser(input, request);

    logAuthEvent("login_success", {
      userId: user.id,
      role: user.role,
    });

    return withAuthCookies(jsonOk({ user }), response);
  } catch (error) {
    logAuthEvent("login_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return jsonError(error);
  }
}
