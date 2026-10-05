import { jsonError } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { getDocumentOriginalBytes } from "@/modules/documents/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { documentId } = await context.params;
    const file = await getDocumentOriginalBytes({
      documentId,
      context: auth,
    });

    return new Response(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
