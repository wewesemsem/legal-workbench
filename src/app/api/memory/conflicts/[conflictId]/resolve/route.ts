import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { resolveMemoryConflict } from "@/modules/memory";

const bodySchema = z
  .object({
    resolution: z.enum(["KEEP_EXISTING", "USE_PROPOSED", "EDITED"]),
    edited_value: z.string().trim().min(1).max(4_000).optional(),
    note: z.string().trim().max(2_000).optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ conflictId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { conflictId } = await context.params;
    const body = bodySchema.parse(await request.json());
    const conflict = await resolveMemoryConflict({
      conflictId,
      resolution: body.resolution,
      editedValue: body.edited_value,
      note: body.note,
      context: auth,
    });
    return jsonOk({
      id: conflict.id,
      status: conflict.status,
      resolution_note: conflict.resolutionNote,
      resolved_at: conflict.resolvedAt,
    });
  } catch (error) {
    return jsonError(error);
  }
}
