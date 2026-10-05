import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { archiveMemory } from "@/modules/memory";

export async function POST(
  request: Request,
  context: { params: Promise<{ memoryId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { memoryId } = await context.params;
    const memory = await archiveMemory({ memoryId, context: auth });
    return jsonOk({ id: memory.id, status: memory.status });
  } catch (error) {
    return jsonError(error);
  }
}
