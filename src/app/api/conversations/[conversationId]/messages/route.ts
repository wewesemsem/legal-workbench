import { z } from "zod";

import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { getClientIp } from "@/lib/rate-limit";
import { requireAuthContext } from "@/modules/auth/service";
import {
  listConversationMessages,
  sendConversationMessage,
} from "@/modules/chat/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { conversationId } = await context.params;
    const messages = await listConversationMessages({
      conversationId,
      context: auth,
    });
    return jsonOk({ messages });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { conversationId } = await context.params;
    const env = getEnv();
    const bodySchema = z.object({
      content: z.string().trim().min(1).max(env.CHAT_MAX_MESSAGE_CHARS),
      explicitUserContext: z.array(z.string().trim().max(4_000)).max(5).optional(),
    });
    const body = bodySchema.parse(await request.json());
    const result = await sendConversationMessage({
      conversationId,
      content: body.content,
      explicitUserContext: body.explicitUserContext,
      context: auth,
      clientKey: getClientIp(request.headers),
    });
    return jsonCreated(result);
  } catch (error) {
    return jsonError(error);
  }
}
