import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/auth";
import { workspaces } from "@/lib/db/schema/workspaces";

export const matterStatusEnum = pgEnum("matter_status", [
  "OPEN",
  "CLOSED",
  "ARCHIVED",
]);

export const matterTypeEnum = pgEnum("matter_type", [
  "CRIMINAL",
  "CIVIL",
  "CORPORATE",
  "EMPLOYMENT",
  "FAMILY",
  "TAX",
  "REAL_ESTATE",
  "IMMIGRATION",
  "OTHER",
]);

export const matterMemberRoleEnum = pgEnum("matter_member_role", [
  "LAWYER",
  "CLIENT",
]);

export const matters = pgTable(
  "matters",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Display name of the matter (API may expose as `name`). */
    title: text("title").notNull(),
    description: text("description"),
    status: matterStatusEnum("status").notNull().default("OPEN"),
    matterType: matterTypeEnum("matter_type").notNull().default("OTHER"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("matters_workspace_idx").on(table.workspaceId)],
);

export const matterMembers = pgTable(
  "matter_members",
  {
    id: text("id").primaryKey(),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: matterMemberRoleEnum("role").notNull().default("LAWYER"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("matter_members_matter_user_uidx").on(
      table.matterId,
      table.userId,
    ),
    index("matter_members_user_idx").on(table.userId),
  ],
);
