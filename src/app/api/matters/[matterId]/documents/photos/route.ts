import { jsonCreated, jsonError } from "@/lib/api";
import { validationError } from "@/modules/authorization/errors";
import { requireAuthContext } from "@/modules/auth/service";
import { uploadMatterPhotoPages } from "@/modules/documents/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const form = await request.formData();
    const title = String(form.get("title") ?? "") || undefined;
    const files = form
      .getAll("pages")
      .filter((value): value is File => value instanceof File);

    if (!files.length) {
      throw validationError("At least one page image is required");
    }

    const pages = [];
    for (const file of files) {
      pages.push({
        originalFilename: file.name || "page.jpg",
        claimedMimeType: file.type,
        content: Buffer.from(await file.arrayBuffer()),
      });
    }

    const document = await uploadMatterPhotoPages({
      matterId,
      context: auth,
      title,
      pages,
    });

    return jsonCreated({ document });
  } catch (error) {
    return jsonError(error);
  }
}
