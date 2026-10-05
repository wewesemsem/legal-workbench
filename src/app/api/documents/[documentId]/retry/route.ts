import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { retryDocumentProcessing } from "@/modules/documents/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { documentId } = await context.params;
    const result = await retryDocumentProcessing({
      documentId,
      context: auth,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
