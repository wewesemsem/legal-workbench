import { eq } from "drizzle-orm";

import { jsonError, jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import {
  assertSameUser,
  notFound,
  requireRole,
} from "@/modules/authorization";
import { requireAuthContext } from "@/modules/auth/service";
import { isUserRole } from "@/modules/users/types";

/**
 * Protected user profile endpoint used to verify authorization foundations.
 * Users may only read their own profile in Phase 1 Step 1.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const authContext = await requireAuthContext(request);
    requireRole(authContext, ["LAWYER", "CLIENT"]);

    const { userId } = await context.params;
    assertSameUser(authContext, userId);

    const rows = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        role: userTable.role,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const row = rows[0];
    if (!row || !isUserRole(row.role)) {
      throw notFound("User not found");
    }

    return jsonOk({ user: row });
  } catch (error) {
    return jsonError(error);
  }
}
