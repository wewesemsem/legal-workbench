import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { getLlmCatalog } from "@/modules/llm";

export async function GET(request: Request) {
  try {
    await requireAuthContext(request);
    const url = new URL(request.url);
    const bypassCache = url.searchParams.get("refresh") === "1";
    const catalog = await getLlmCatalog({ bypassCache });
    return jsonOk(catalog, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
