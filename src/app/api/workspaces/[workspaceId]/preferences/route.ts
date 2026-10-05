import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { memories } from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireAuthContext } from "@/modules/auth/service";
import { createMemory } from "@/modules/memory";
import { assertWorkspaceAccess } from "@/modules/authorization/permissions";

const createSchema = z
  .object({
    key: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(4_000),
  })
  .strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    await assertWorkspaceAccess({ workspaceId, context: auth });
    const rows = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.workspaceId, workspaceId),
          eq(memories.type, "WORKSPACE_PREFERENCE"),
          isNull(memories.matterId),
          inArray(memories.status, ["ACTIVE"]),
        ),
      );
    return jsonOk({
      preferences: rows.map((row) => ({
        id: row.id,
        key: row.key,
        value: row.value,
        source_type: row.sourceType,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    if (auth.role !== "LAWYER") {
      return jsonOk(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only lawyers can set workspace preferences",
          },
        },
        { status: 403 },
      );
    }
    await assertWorkspaceAccess({ workspaceId, context: auth });
    const body = createSchema.parse(await request.json());
    const result = await createMemory({
      data: {
        workspaceId,
        type: "WORKSPACE_PREFERENCE",
        key: body.key,
        value: body.value,
        sourceType: "USER_PROVIDED",
        requireConfirmation: false,
      },
      context: auth,
    });
    if (result.status === "REJECTED") {
      return jsonOk({ status: result.status, reason: result.reason }, { status: 400 });
    }
    if (result.status === "CONFLICT_DETECTED") {
      return jsonOk({ status: result.status, conflict_id: result.conflict.id });
    }
    return jsonOk({
      status: result.status,
      preference: {
        id: result.memory.id,
        key: result.memory.key,
        value: result.memory.value,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
