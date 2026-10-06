import { asc, eq } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import {
  forbidden,
  rateLimited,
  validationError,
} from "@/modules/authorization/errors";
import {
  assertConversationAccess,
  assertMatterAccess,
  type AuthContext,
} from "@/modules/authorization/permissions";
import { chatWithLlmSelection } from "@/modules/llm";
import {
  buildMatterContext,
  matterContextToLlmMessages,
} from "@/modules/matter-context/service";
import { checkRateLimit } from "@/lib/rate-limit";

const SAFE_LLM_ERROR =
  "The assistant is temporarily unavailable. Please try again.";

function publicConversation(row: typeof conversations.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    matterId: row.matterId,
    createdBy: row.createdBy,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function publicMessage(row: typeof messages.$inferSelect) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

function logChatEvent(
  action: string,
  meta: Record<string, string | number | boolean | null | undefined>,
) {
  // Never log message contents.
  console.info("[chat]", action, meta);
}

export async function createConversation(input: {
  matterId: string;
  title?: string;
  context: AuthContext;
}) {
  const access = await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  const title = (input.title?.trim() || "New conversation").slice(0, 160);
  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(conversations).values({
    id,
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    createdBy: input.context.userId,
    title,
    createdAt: now,
    updatedAt: now,
  });

  logChatEvent("conversation.created", {
    conversationId: id,
    matterId: access.matterId,
    workspaceId: access.workspaceId,
    userId: input.context.userId,
  });

  return publicConversation({
    id,
    workspaceId: access.workspaceId,
    matterId: access.matterId,
    createdBy: input.context.userId,
    title,
    createdAt: now,
    updatedAt: now,
  });
}

export async function listConversationsForMatter(input: {
  matterId: string;
  context: AuthContext;
}) {
  await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.matterId, input.matterId))
    .orderBy(asc(conversations.updatedAt));

  return rows.map(publicConversation).reverse();
}

export async function getConversationForUser(input: {
  conversationId: string;
  context: AuthContext;
}) {
  const access = await assertConversationAccess({
    conversationId: input.conversationId,
    context: input.context,
  });

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .limit(1);

  const conversation = rows[0];
  if (!conversation) {
    throw forbidden("You do not have access to this conversation");
  }

  return {
    conversation: publicConversation(conversation),
    access,
  };
}

export async function updateConversation(input: {
  conversationId: string;
  title: string;
  context: AuthContext;
}) {
  await assertConversationAccess({
    conversationId: input.conversationId,
    context: input.context,
  });

  const title = input.title.trim();
  if (!title) {
    throw validationError("Conversation title is required");
  }

  const now = new Date();
  await db
    .update(conversations)
    .set({ title: title.slice(0, 160), updatedAt: now })
    .where(eq(conversations.id, input.conversationId));

  const { conversation } = await getConversationForUser({
    conversationId: input.conversationId,
    context: input.context,
  });
  return conversation;
}

export async function deleteConversation(input: {
  conversationId: string;
  context: AuthContext;
}) {
  const access = await assertConversationAccess({
    conversationId: input.conversationId,
    context: input.context,
  });

  await db
    .delete(conversations)
    .where(eq(conversations.id, input.conversationId));

  logChatEvent("conversation.deleted", {
    conversationId: input.conversationId,
    matterId: access.matterId,
    workspaceId: access.workspaceId,
    userId: input.context.userId,
  });

  return { deleted: true as const };
}

export async function listConversationMessages(input: {
  conversationId: string;
  context: AuthContext;
}) {
  await assertConversationAccess({
    conversationId: input.conversationId,
    context: input.context,
  });

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, input.conversationId))
    .orderBy(asc(messages.createdAt));

  return rows.map(publicMessage);
}

export async function sendConversationMessage(input: {
  conversationId: string;
  content: string;
  explicitUserContext?: string[];
  provider?: string;
  model?: string;
  context: AuthContext;
  clientKey?: string;
}) {
  const env = getEnv();
  const access = await assertConversationAccess({
    conversationId: input.conversationId,
    context: input.context,
  });

  const rateKey = `chat:${input.context.userId}:${access.matterId}`;
  const rate = checkRateLimit(
    rateKey,
    env.CHAT_RATE_LIMIT_MAX_ATTEMPTS,
    env.CHAT_RATE_LIMIT_WINDOW_MS,
  );
  if (!rate.allowed) {
    throw rateLimited("Too many chat requests. Please try again shortly.");
  }

  const content = input.content.trim();
  if (!content) {
    throw validationError("Message content is required");
  }
  if (content.length > env.CHAT_MAX_MESSAGE_CHARS) {
    throw validationError(
      `Message exceeds the maximum length of ${env.CHAT_MAX_MESSAGE_CHARS} characters`,
    );
  }

  const now = new Date();
  const userMessageId = crypto.randomUUID();

  await db.insert(messages).values({
    id: userMessageId,
    conversationId: input.conversationId,
    role: "USER",
    content,
    metadata: {
      source: "user",
    },
    createdAt: now,
  });

  // Auto-title from first user message when still default.
  const [conversationRow] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .limit(1);

  if (conversationRow?.title === "New conversation") {
    await db
      .update(conversations)
      .set({
        title: content.slice(0, 80),
        updatedAt: now,
      })
      .where(eq(conversations.id, input.conversationId));
  } else {
    await db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, input.conversationId));
  }

  logChatEvent("message.user_created", {
    conversationId: input.conversationId,
    matterId: access.matterId,
    messageId: userMessageId,
    userId: input.context.userId,
    clientKey: input.clientKey ?? null,
  });

  const matterContext = await buildMatterContext({
    matterId: access.matterId,
    context: input.context,
    conversationId: input.conversationId,
    explicitUserContext: input.explicitUserContext,
  });

  // Isolation invariant for tests/callers.
  if (matterContext.matter.id !== access.matterId) {
    throw new Error("Matter context boundary violation");
  }
  if (
    matterContext.conversation &&
    matterContext.conversation.id !== input.conversationId
  ) {
    throw new Error("Conversation context boundary violation");
  }

  const llmMessages = matterContextToLlmMessages(matterContext);

  let assistantContent: string;
  let assistantMetadata: Record<string, unknown>;

  try {
    const result = await chatWithLlmSelection({
      messages: llmMessages,
      provider: input.provider,
      model: input.model,
    });
    assistantContent = result.content;
    assistantMetadata = {
      model: result.model,
      provider: result.provider,
      latency_ms: result.latencyMs,
      context_sources: ["matter_context", "conversation_history"],
      citations: [],
      tool_calls: [],
      layers: matterContext.layers,
      ...result.metadata,
    };
  } catch (error) {
    console.error("[chat] llm failure", {
      conversationId: input.conversationId,
      matterId: access.matterId,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
    throw validationError(SAFE_LLM_ERROR);
  }

  const assistantMessageId = crypto.randomUUID();
  const assistantCreatedAt = new Date();
  await db.insert(messages).values({
    id: assistantMessageId,
    conversationId: input.conversationId,
    role: "ASSISTANT",
    content: assistantContent,
    metadata: assistantMetadata,
    createdAt: assistantCreatedAt,
  });

  await db
    .update(conversations)
    .set({ updatedAt: assistantCreatedAt })
    .where(eq(conversations.id, input.conversationId));

  logChatEvent("message.assistant_created", {
    conversationId: input.conversationId,
    matterId: access.matterId,
    messageId: assistantMessageId,
    userId: input.context.userId,
    provider: String(assistantMetadata.provider ?? "unknown"),
  });

  return {
    userMessage: publicMessage({
      id: userMessageId,
      conversationId: input.conversationId,
      role: "USER",
      content,
      metadata: { source: "user" },
      createdAt: now,
    }),
    assistantMessage: publicMessage({
      id: assistantMessageId,
      conversationId: input.conversationId,
      role: "ASSISTANT",
      content: assistantContent,
      metadata: assistantMetadata,
      createdAt: assistantCreatedAt,
    }),
    matterContextSummary: {
      matterId: matterContext.matter.id,
      documentCount: matterContext.documents.length,
      participantCount: matterContext.participants.length,
      layers: matterContext.layers,
    },
  };
}

/** Exported for isolation tests — builds context after access checks. */
export async function getAuthorizedMatterContextForTests(input: {
  matterId: string;
  conversationId?: string;
  context: AuthContext;
}) {
  return buildMatterContext(input);
}
