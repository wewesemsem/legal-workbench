import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { validationError } from "@/modules/authorization/errors";
import { requireAuthContext } from "@/modules/auth/service";
import {
  listMatterDocuments,
  uploadMatterDocument,
} from "@/modules/documents/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const documents = await listMatterDocuments({
      matterId,
      context: auth,
    });
    return jsonOk({ documents });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw validationError("file is required");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const document = await uploadMatterDocument({
      matterId,
      context: auth,
      originalFilename: file.name || "upload.bin",
      claimedMimeType: file.type,
      content: bytes,
      processInline: true,
    });

    return jsonCreated({ document });
  } catch (error) {
    return jsonError(error);
  }
}
