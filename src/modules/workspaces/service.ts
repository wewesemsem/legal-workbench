import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  matterMembers,
  matters,
  user,
  workspaceMembers,
  workspaces,
} from "@/lib/db/schema";
import {
  forbidden,
  notFound,
  validationError,
} from "@/modules/authorization/errors";
import {
  assertWorkspaceAccess,
  canLawyerManageWorkspaces,
  type AuthContext,
} from "@/modules/authorization/permissions";

function canManageWorkspace(role: "OWNER" | "LAWYER" | "CLIENT") {
  return role === "OWNER" || role === "LAWYER";
}

export async function createWorkspace(input: {
  name: string;
  context: AuthContext;
}) {
  if (!canLawyerManageWorkspaces(input.context.role)) {
    throw forbidden("Only lawyers can create workspaces");
  }

  const name = input.name.trim();
  if (!name) {
    throw validationError("Workspace name is required");
  }

  const workspaceId = crypto.randomUUID();
  const now = new Date();

  await db.insert(workspaces).values({
    id: workspaceId,
    name,
    createdBy: input.context.userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaceMembers).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId: input.context.userId,
    role: "OWNER",
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: workspaceId,
    name,
    ownerId: input.context.userId,
    role: "OWNER" as const,
    matterCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listWorkspacesForUser(context: AuthContext) {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.createdBy,
      role: workspaceMembers.role,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      matterCount: sql<number>`cast(count(distinct ${matterMembers.matterId}) as int)`,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .leftJoin(matters, eq(matters.workspaceId, workspaces.id))
    .leftJoin(
      matterMembers,
      and(
        eq(matterMembers.matterId, matters.id),
        eq(matterMembers.userId, context.userId),
      ),
    )
    .where(eq(workspaceMembers.userId, context.userId))
    .groupBy(
      workspaces.id,
      workspaces.name,
      workspaces.createdBy,
      workspaceMembers.role,
      workspaces.createdAt,
      workspaces.updatedAt,
    );

  return rows;
}

export async function getWorkspaceForUser(input: {
  workspaceId: string;
  context: AuthContext;
}) {
  const access = await assertWorkspaceAccess({
    workspaceId: input.workspaceId,
    context: input.context,
  });

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.createdBy,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  const workspace = rows[0];
  if (!workspace) {
    throw notFound("Workspace not found");
  }

  const [matterCountRow] = await db
    .select({ value: count() })
    .from(matters)
    .innerJoin(
      matterMembers,
      and(
        eq(matterMembers.matterId, matters.id),
        eq(matterMembers.userId, input.context.userId),
      ),
    )
    .where(eq(matters.workspaceId, input.workspaceId));

  return {
    ...workspace,
    role: access.memberRole,
    matterCount: Number(matterCountRow?.value ?? 0),
  };
}

export async function updateWorkspace(input: {
  workspaceId: string;
  name: string;
  context: AuthContext;
}) {
  const access = await assertWorkspaceAccess({
    workspaceId: input.workspaceId,
    context: input.context,
  });

  if (!canManageWorkspace(access.memberRole)) {
    throw forbidden("You are not allowed to update this workspace");
  }

  const name = input.name.trim();
  if (!name) {
    throw validationError("Workspace name is required");
  }

  const now = new Date();
  await db
    .update(workspaces)
    .set({ name, updatedAt: now })
    .where(eq(workspaces.id, input.workspaceId));

  return getWorkspaceForUser({
    workspaceId: input.workspaceId,
    context: input.context,
  });
}

export async function deleteWorkspace(input: {
  workspaceId: string;
  context: AuthContext;
}) {
  const access = await assertWorkspaceAccess({
    workspaceId: input.workspaceId,
    context: input.context,
  });

  if (access.memberRole !== "OWNER") {
    throw forbidden("Only the workspace owner can delete this workspace");
  }

  await db.delete(workspaces).where(eq(workspaces.id, input.workspaceId));
  return { deleted: true as const };
}

export async function listWorkspaceMembers(input: {
  workspaceId: string;
  context: AuthContext;
}) {
  await assertWorkspaceAccess({
    workspaceId: input.workspaceId,
    context: input.context,
  });

  return db
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: workspaceMembers.createdAt,
      updatedAt: workspaceMembers.updatedAt,
    })
    .from(workspaceMembers)
    .innerJoin(user, eq(user.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, input.workspaceId));
}

export async function ensureDefaultWorkspace(context: AuthContext) {
  const existing = await listWorkspacesForUser(context);
  if (existing[0]) {
    return existing[0];
  }

  if (!canLawyerManageWorkspaces(context.role)) {
    throw forbidden(
      "No workspace available. Ask your lawyer to invite you to a matter.",
    );
  }

  return createWorkspace({
    name: `${context.firstName}'s Workspace`,
    context,
  });
}
