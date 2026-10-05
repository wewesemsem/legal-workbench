import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  deleteWorkspace,
  getWorkspaceForUser,
  updateWorkspace,
} from "@/modules/workspaces/service";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    const workspace = await getWorkspaceForUser({
      workspaceId,
      context: auth,
    });
    return jsonOk({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    const body = updateSchema.parse(await request.json());
    const workspace = await updateWorkspace({
      workspaceId,
      name: body.name,
      context: auth,
    });
    return jsonOk({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    const result = await deleteWorkspace({
      workspaceId,
      context: auth,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
