import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { listDocumentPages } from "@/modules/documents/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { documentId } = await context.params;
    const pages = await listDocumentPages({
      documentId,
      context: auth,
    });
    return jsonOk({ pages });
  } catch (error) {
    return jsonError(error);
  }
}
