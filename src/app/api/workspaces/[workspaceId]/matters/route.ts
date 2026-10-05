import { z } from "zod";

import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import { createMatter, listMattersForUser } from "@/modules/matters/service";
import { MATTER_TYPES } from "@/modules/matters/types";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  matterType: z.enum(MATTER_TYPES).optional(),
}).refine((value) => Boolean(value.title || value.name), {
  message: "Matter title is required",
  path: ["title"],
});

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    const matters = await listMattersForUser({ workspaceId, context: auth });
    return jsonOk({ matters });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { workspaceId } = await context.params;
    const body = createSchema.parse(await request.json());
    const matter = await createMatter({
      workspaceId,
      title: (body.title ?? body.name) as string,
      description: body.description,
      matterType: body.matterType,
      context: auth,
    });
    return jsonCreated({ matter });
  } catch (error) {
    return jsonError(error);
  }
}
