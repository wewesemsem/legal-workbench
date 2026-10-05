import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  deleteConversation,
  getConversationForUser,
  updateConversation,
} from "@/modules/chat/service";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(160),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { conversationId } = await context.params;
    const result = await getConversationForUser({
      conversationId,
      context: auth,
    });
    return jsonOk({ conversation: result.conversation });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { conversationId } = await context.params;
    const body = updateSchema.parse(await request.json());
    const conversation = await updateConversation({
      conversationId,
      title: body.title,
      context: auth,
    });
    return jsonOk({ conversation });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { conversationId } = await context.params;
    const result = await deleteConversation({
      conversationId,
      context: auth,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
