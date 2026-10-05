import { z } from "zod";

import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  createWorkspace,
  ensureDefaultWorkspace,
  listWorkspacesForUser,
} from "@/modules/workspaces/service";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  try {
    const context = await requireAuthContext(request);
    let workspaces = await listWorkspacesForUser(context);
    if (!workspaces.length && context.role === "LAWYER") {
      await ensureDefaultWorkspace(context);
      workspaces = await listWorkspacesForUser(context);
    }
    return jsonOk({ workspaces });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext(request);
    const body = createSchema.parse(await request.json());
    const workspace = await createWorkspace({
      name: body.name,
      context,
    });
    return jsonCreated({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
