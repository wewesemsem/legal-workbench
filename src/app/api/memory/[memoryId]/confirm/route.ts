import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { confirmMemory } from "@/modules/memory";

export async function POST(
  request: Request,
  context: { params: Promise<{ memoryId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { memoryId } = await context.params;
    const memory = await confirmMemory({ memoryId, context: auth });
    return jsonOk({
      id: memory.id,
      key: memory.key,
      value: memory.value,
      source_type: memory.sourceType,
      status: memory.status,
      confirmed_at: memory.confirmedAt,
      confirmed_by: memory.confirmedBy,
    });
  } catch (error) {
    return jsonError(error);
  }
}
