import { jsonError, jsonOk, withAuthCookies } from "@/lib/api";
import { logAuthEvent, logoutUser } from "@/modules/auth/service";

export async function POST(request: Request) {
  try {
    const { response } = await logoutUser(request);
    logAuthEvent("logout_success");
    return withAuthCookies(jsonOk({ success: true }), response);
  } catch (error) {
    return jsonError(error);
  }
}
