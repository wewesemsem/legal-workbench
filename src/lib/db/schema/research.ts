import {
  doublePrecision,
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

export const researchSourceModeEnum = pgEnum("research_source_mode", [
  "CORPUS",
  "WEB",
  "BOTH",
]);

export const researchRuns = pgTable(
  "research_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    sourceMode: researchSourceModeEnum("source_mode").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("research_runs_matter_idx").on(table.matterId),
    index("research_runs_workspace_idx").on(table.workspaceId),
    index("research_runs_user_idx").on(table.userId),
  ],
);

export const researchSources = pgTable(
  "research_sources",
  {
    id: text("id").primaryKey(),
    researchRunId: text("research_run_id")
      .notNull()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    sourceType: text("source_type").notNull().default("WEB"),
    authorityStatus: text("authority_status").notNull(),
    sourceStatus: text("source_status"),
    domain: text("domain"),
    publishedAt: text("published_at"),
    retrievedAt: timestamp("retrieved_at"),
    relevanceScore: doublePrecision("relevance_score"),
    excerpt: text("excerpt"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("research_sources_run_idx").on(table.researchRunId)],
);
