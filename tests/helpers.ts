import { eq, inArray, like } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  account,
  agentAuditEvents,
  agentRuns,
  agentSteps,
  approvalRequests,
  conversations,
  documentAuditLogs,
  documentPages,
  documents,
  legalChunks,
  legalDiscoveredDocuments,
  legalDocuments,
  legalIngestionRuns,
  legalProvisions,
  legalSources,
  matterDocumentChunks,
  matterMembers,
  matters,
  memories,
  memoryConflicts,
  messages,
  researchRuns,
  researchSources,
  session,
  user,
  verification,
  workspaceMembers,
  workspaces,
} from "@/lib/db/schema";
import { resetEnvCacheForTests } from "@/lib/env";
import { resetRateLimitStoreForTests } from "@/lib/rate-limit";
import { resetAgentModelGatewayForTests } from "@/modules/agents/model-gateway";
import { resetToolRegistryForTests } from "@/modules/agents/tools/registry";
import { resetEmbeddingProviderForTests } from "@/modules/legal-retrieval/embeddings";
import { resetLegalEmbeddingServiceForTests } from "@/modules/legal-retrieval/embedding-service";
import {
  clearConsoleSentEmails,
  findConsoleEmail,
} from "@/modules/email/providers/console";

import { databaseNameFromUrl, toTestDatabaseUrl } from "./database-url";

export { toTestDatabaseUrl };

/** Hard guard: corpus wipes must never run against the live/dev database. */
export function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const dbName = databaseNameFromUrl(databaseUrl);
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing destructive legal-corpus cleanup against database "${dbName || databaseUrl}". Vitest must use a *_test DATABASE_URL.`,
    );
  }
}

/**
 * Wipe legal-corpus tables inside the isolated test database only.
 * Call sites previously did unscoped deletes against the shared live DB.
 */
export async function clearLegalCorpusTablesForTests() {
  assertTestDatabase();
  await db.delete(legalChunks);
  await db.delete(legalProvisions);
  await db.delete(legalDocuments);
  await db.delete(legalDiscoveredDocuments);
  await db.delete(legalIngestionRuns);
  await db.delete(legalSources);
}

export const STRONG_PASSWORD = "SecurePass123!";

export function uniqueEmail(prefix = "user") {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

export function collectCookies(response: Response): string {
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length === 0) {
    const single = response.headers.get("set-cookie");
    return single ? single.split(";")[0] : "";
  }

  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

export function extractVerificationTokenFromEmail(emailAddress: string) {
  const message = findConsoleEmail(emailAddress, "Confirm your Legal Workbench");
  if (!message) {
    throw new Error("Verification email not found in console provider");
  }

  const match = message.text.match(
    /\/api\/auth\/verify-email\?token=([A-Za-z0-9_-]+)/,
  );
  if (!match?.[1]) {
    throw new Error("Verification token not found in email body");
  }

  return match[1];
}

export async function cleanupUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  const existing = rows[0];
  if (!existing) {
    await db
      .delete(verification)
      .where(like(verification.identifier, `%${normalized}%`));
    return;
  }

  const userId = existing.id;

  const ownedWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.createdBy, userId));
  const workspaceIds = ownedWorkspaces.map((row) => row.id);

  if (workspaceIds.length) {
    const matterRows = await db
      .select({ id: matters.id })
      .from(matters)
      .where(inArray(matters.workspaceId, workspaceIds));
    const matterIds = matterRows.map((row) => row.id);

    if (matterIds.length) {
      const documentRows = await db
        .select({ id: documents.id })
        .from(documents)
        .where(inArray(documents.matterId, matterIds));
      const documentIds = documentRows.map((row) => row.id);

      if (documentIds.length) {
        await db
          .delete(matterDocumentChunks)
          .where(inArray(matterDocumentChunks.documentId, documentIds));
        await db
          .delete(documentAuditLogs)
          .where(inArray(documentAuditLogs.documentId, documentIds));
        await db
          .delete(documentPages)
          .where(inArray(documentPages.documentId, documentIds));
        await db.delete(documents).where(inArray(documents.id, documentIds));
      }

      const conversationRows = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(inArray(conversations.matterId, matterIds));
      const conversationIds = conversationRows.map((row) => row.id);
      if (conversationIds.length) {
        await db
          .delete(messages)
          .where(inArray(messages.conversationId, conversationIds));
        await db
          .delete(conversations)
          .where(inArray(conversations.id, conversationIds));
      }

      const researchRunRows = await db
        .select({ id: researchRuns.id })
        .from(researchRuns)
        .where(inArray(researchRuns.matterId, matterIds));
      const researchRunIds = researchRunRows.map((row) => row.id);
      if (researchRunIds.length) {
        await db
          .delete(researchSources)
          .where(inArray(researchSources.researchRunId, researchRunIds));
        await db.delete(researchRuns).where(inArray(researchRuns.id, researchRunIds));
      }

      const agentRunRows = await db
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(inArray(agentRuns.matterId, matterIds));
      const agentRunIds = agentRunRows.map((row) => row.id);
      if (agentRunIds.length) {
        await db
          .delete(approvalRequests)
          .where(inArray(approvalRequests.agentRunId, agentRunIds));
        await db.delete(agentSteps).where(inArray(agentSteps.agentRunId, agentRunIds));
        await db
          .delete(agentAuditEvents)
          .where(inArray(agentAuditEvents.agentRunId, agentRunIds));
        await db.delete(agentRuns).where(inArray(agentRuns.id, agentRunIds));
      }
      await db
        .delete(agentAuditEvents)
        .where(inArray(agentAuditEvents.matterId, matterIds));

      await db
        .delete(memoryConflicts)
        .where(inArray(memoryConflicts.matterId, matterIds));
      await db.delete(memories).where(inArray(memories.matterId, matterIds));

      await db.delete(matterMembers).where(inArray(matterMembers.matterId, matterIds));
      await db.delete(matters).where(inArray(matters.id, matterIds));
    }

    await db
      .delete(memoryConflicts)
      .where(inArray(memoryConflicts.workspaceId, workspaceIds));
    await db.delete(memories).where(inArray(memories.workspaceId, workspaceIds));

    await db
      .delete(workspaceMembers)
      .where(inArray(workspaceMembers.workspaceId, workspaceIds));
    await db.delete(workspaces).where(inArray(workspaces.id, workspaceIds));
  }

  await db.delete(matterMembers).where(eq(matterMembers.userId, userId));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId));
  await db.delete(session).where(eq(session.userId, userId));
  await db.delete(account).where(eq(account.userId, userId));
  await db
    .delete(verification)
    .where(eq(verification.identifier, `email-verification:${normalized}`));
  await db.delete(user).where(eq(user.id, userId));
}

export function resetTestState() {
  resetRateLimitStoreForTests();
  resetEnvCacheForTests();
  resetEmbeddingProviderForTests();
  resetLegalEmbeddingServiceForTests();
  resetAgentModelGatewayForTests();
  resetToolRegistryForTests();
  clearConsoleSentEmails();
}
