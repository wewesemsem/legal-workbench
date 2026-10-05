import { z } from "zod";

import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  createConversation,
  listConversationsForMatter,
} from "@/modules/chat/service";

const createSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const conversations = await listConversationsForMatter({
      matterId,
      context: auth,
    });
    return jsonOk({ conversations });
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
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const conversation = await createConversation({
      matterId,
      title: body.title,
      context: auth,
    });
    return jsonCreated({ conversation });
  } catch (error) {
    return jsonError(error);
  }
}
