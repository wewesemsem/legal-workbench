import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { memories } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuthContext } from "@/modules/auth/service";
import { createMemory } from "@/modules/memory";
import { assertWorkspaceAccess } from "@/modules/authorization/permissions";

const createSchema = z
  .object({
    workspace_id: z.string().trim().min(1),
    key: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(4_000),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id");
    if (!workspaceId) {
      return jsonOk(
        { error: { code: "VALIDATION_ERROR", message: "workspace_id is required" } },
        { status: 400 },
      );
    }
    await assertWorkspaceAccess({ workspaceId, context: auth });
    const rows = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.workspaceId, workspaceId),
          eq(memories.type, "USER_PREFERENCE"),
          eq(memories.userId, auth.userId),
          inArray(memories.status, ["ACTIVE"]),
        ),
      );
    return jsonOk({
      preferences: rows.map((row) => ({
        id: row.id,
        key: row.key,
        value: row.value,
        source_type: row.sourceType,
        confidence: row.confidence,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const body = createSchema.parse(await request.json());
    await assertWorkspaceAccess({
      workspaceId: body.workspace_id,
      context: auth,
    });
    const result = await createMemory({
      data: {
        workspaceId: body.workspace_id,
        type: "USER_PREFERENCE",
        userId: auth.userId,
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
