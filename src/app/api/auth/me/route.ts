import { jsonError, jsonOk } from "@/lib/api";
import { unauthenticated } from "@/modules/authorization/errors";
import {
  assertSameUser,
  requireRole,
} from "@/modules/authorization/permissions";
import { getSessionUser, requireAuthContext } from "@/modules/auth/service";

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext(request);
    requireRole(context, ["LAWYER", "CLIENT"]);
    assertSameUser(context, context.userId);

    const user = await getSessionUser(request);
    if (!user) {
      throw unauthenticated();
    }

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
