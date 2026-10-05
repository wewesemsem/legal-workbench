import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  conversations,
  documentAuditLogs,
  documents,
  matterMembers,
  matters,
  workspaceMembers,
} from "@/lib/db/schema";
import type { UserRole } from "@/modules/users/types";
import { forbidden, notFound, unauthenticated } from "@/modules/authorization/errors";

export type AuthContext = {
  userId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
};

export type WorkspaceAccess = {
  workspaceId: string;
  memberRole: "OWNER" | "LAWYER" | "CLIENT";
};

export type MatterAccess = {
  matterId: string;
  workspaceId: string;
  memberRole: "LAWYER" | "CLIENT";
};

export type ConversationAccess = {
  conversationId: string;
  matterId: string;
  workspaceId: string;
  memberRole: "LAWYER" | "CLIENT";
  title: string;
};

export function assertAuthenticated(
  context: AuthContext | null | undefined,
): asserts context is AuthContext {
  if (!context) {
    throw unauthenticated();
  }
}

export function requireRole(context: AuthContext, allowed: readonly UserRole[]) {
  if (!allowed.includes(context.role)) {
    throw forbidden(`Role ${context.role} is not authorized for this action`);
  }
}

export function assertSameUser(context: AuthContext, resourceOwnerId: string) {
  if (context.userId !== resourceOwnerId) {
    throw forbidden("You cannot access another user's resources");
  }
}

export async function assertWorkspaceAccess(input: {
  workspaceId: string;
  context: AuthContext;
}): Promise<WorkspaceAccess> {
  const rows = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.context.userId),
      ),
    )
    .limit(1);

  const membership = rows[0];
  if (!membership) {
    throw forbidden("You do not have access to this workspace");
  }

  return {
    workspaceId: membership.workspaceId,
    memberRole: membership.role,
  };
}

export async function assertMatterAccess(input: {
  matterId: string;
  context: AuthContext;
}): Promise<MatterAccess> {
  const rows = await db
    .select({
      matterId: matters.id,
      workspaceId: matters.workspaceId,
      memberRole: matterMembers.role,
    })
    .from(matters)
    .innerJoin(
      matterMembers,
      and(
        eq(matterMembers.matterId, matters.id),
        eq(matterMembers.userId, input.context.userId),
      ),
    )
    .where(eq(matters.id, input.matterId))
    .limit(1);

  const membership = rows[0];
  if (!membership) {
    // Also require workspace membership for defense in depth.
    throw forbidden("You do not have access to this matter");
  }

  await assertWorkspaceAccess({
    workspaceId: membership.workspaceId,
    context: input.context,
  });

  return {
    matterId: membership.matterId,
    workspaceId: membership.workspaceId,
    memberRole: membership.memberRole,
  };
}

export async function assertDocumentAccess(input: {
  documentId: string;
  context: AuthContext;
}) {
  const rows = await db
    .select({
      id: documents.id,
      workspaceId: documents.workspaceId,
      matterId: documents.matterId,
      filename: documents.filename,
      processingStatus: documents.processingStatus,
    })
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);

  const document = rows[0];
  if (!document) {
    throw notFound("Document not found");
  }

  const matterAccess = await assertMatterAccess({
    matterId: document.matterId,
    context: input.context,
  });

  return {
    ...document,
    memberRole: matterAccess.memberRole,
  };
}

export async function writeDocumentAudit(input: {
  documentId: string;
  workspaceId: string;
  matterId: string;
  actorUserId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(documentAuditLogs).values({
    id: crypto.randomUUID(),
    documentId: input.documentId,
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    actorUserId: input.actorUserId,
    action: input.action,
    // Never include document text/content in audit metadata.
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  });
}

export function canLawyerManageWorkspaces(role: UserRole): boolean {
  return role === "LAWYER";
}

export function canUploadToMatter(memberRole: "LAWYER" | "CLIENT") {
  return memberRole === "LAWYER" || memberRole === "CLIENT";
}

export function canDeleteMatterDocument(memberRole: "LAWYER" | "CLIENT") {
  return memberRole === "LAWYER";
}

export async function assertConversationAccess(input: {
  conversationId: string;
  context: AuthContext;
}): Promise<ConversationAccess> {
  const rows = await db
    .select({
      conversationId: conversations.id,
      matterId: conversations.matterId,
      workspaceId: conversations.workspaceId,
      title: conversations.title,
    })
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .limit(1);

  const conversation = rows[0];
  if (!conversation) {
    throw notFound("Conversation not found");
  }

  const matterAccess = await assertMatterAccess({
    matterId: conversation.matterId,
    context: input.context,
  });

  return {
    conversationId: conversation.conversationId,
    matterId: conversation.matterId,
    workspaceId: conversation.workspaceId,
    title: conversation.title,
    memberRole: matterAccess.memberRole,
  };
}
