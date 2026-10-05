import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/auth";
import { matters } from "@/lib/db/schema/matters";
import { workspaces } from "@/lib/db/schema/workspaces";

export const messageRoleEnum = pgEnum("message_role", [
  "USER",
  "ASSISTANT",
  "SYSTEM",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("conversations_matter_idx").on(table.matterId),
    index("conversations_workspace_idx").on(table.workspaceId),
    index("conversations_created_by_idx").on(table.createdBy),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId),
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);
