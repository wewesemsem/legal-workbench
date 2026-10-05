import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { listWorkspaceMembers } from "@/modules/workspaces/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    const members = await listWorkspaceMembers({
      workspaceId,
      context: auth,
    });
    return jsonOk({ members });
  } catch (error) {
    return jsonError(error);
  }
}
