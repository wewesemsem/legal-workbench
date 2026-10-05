import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  deleteMatterDocument,
  getMatterDocument,
} from "@/modules/documents/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { documentId } = await context.params;
    const result = await getMatterDocument({
      documentId,
      context: auth,
      includeExtractedText: true,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { documentId } = await context.params;
    const result = await deleteMatterDocument({
      documentId,
      context: auth,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
