import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  archiveMemory,
  deleteMemory,
  getMemoryById,
  updateMemory,
} from "@/modules/memory";

const patchSchema = z
  .object({
    key: z.string().trim().min(1).max(120).optional(),
    value: z.string().trim().min(1).max(4_000).optional(),
  })
  .strict()
  .refine((value) => value.key !== undefined || value.value !== undefined, {
    message: "At least one of key or value is required",
  });

export async function GET(
  request: Request,
  context: { params: Promise<{ memoryId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { memoryId } = await context.params;
    const memory = await getMemoryById({ memoryId, context: auth });
    return jsonOk({
      id: memory.id,
      workspace_id: memory.workspaceId,
      matter_id: memory.matterId,
      type: memory.type,
      key: memory.key,
      value: memory.value,
      source_type: memory.sourceType,
      confidence: memory.confidence,
      status: memory.status,
      confirmed_at: memory.confirmedAt,
      confirmed_by: memory.confirmedBy,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ memoryId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { memoryId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const memory = await updateMemory({
      memoryId,
      key: body.key,
      value: body.value,
      context: auth,
    });
    return jsonOk({
      id: memory.id,
      key: memory.key,
      value: memory.value,
      source_type: memory.sourceType,
      status: memory.status,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ memoryId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { memoryId } = await context.params;
    const url = new URL(request.url);
    if (url.searchParams.get("mode") === "archive") {
      const memory = await archiveMemory({ memoryId, context: auth });
      return jsonOk({ id: memory.id, status: memory.status });
    }
    const result = await deleteMemory({ memoryId, context: auth });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
