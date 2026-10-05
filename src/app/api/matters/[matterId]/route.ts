import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  deleteMatter,
  getMatterForUser,
  updateMatter,
} from "@/modules/matters/service";
import { MATTER_STATUSES, MATTER_TYPES } from "@/modules/matters/types";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(MATTER_STATUSES).optional(),
    matterType: z.enum(MATTER_TYPES).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.status !== undefined ||
      value.matterType !== undefined,
    { message: "At least one field is required" },
  );

export async function GET(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const matter = await getMatterForUser({ matterId, context: auth });
    return jsonOk({ matter });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const body = updateSchema.parse(await request.json());
    const matter = await updateMatter({
      matterId,
      context: auth,
      title: body.title ?? body.name,
      description: body.description,
      status: body.status,
      matterType: body.matterType,
    });
    return jsonOk({ matter });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const result = await deleteMatter({ matterId, context: auth });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
