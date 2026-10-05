import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { matterMembers, matters, user } from "@/lib/db/schema";
import {
  forbidden,
  notFound,
  validationError,
} from "@/modules/authorization/errors";
import {
  assertMatterAccess,
  assertWorkspaceAccess,
  type AuthContext,
} from "@/modules/authorization/permissions";
import {
  MATTER_STATUSES,
  MATTER_TYPES,
  type MatterStatus,
  type MatterType,
} from "@/modules/matters/types";

function canManageMatter(role: "LAWYER" | "CLIENT") {
  return role === "LAWYER";
}

function serializeMatter(row: {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: MatterStatus;
  matterType: MatterType;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  memberRole?: "LAWYER" | "CLIENT";
}) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.title,
    title: row.title,
    description: row.description,
    status: row.status,
    matterType: row.matterType,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberRole: row.memberRole,
  };
}

export async function createMatter(input: {
  workspaceId: string;
  title: string;
  description?: string;
  matterType?: MatterType;
  context: AuthContext;
}) {
  const access = await assertWorkspaceAccess({
    workspaceId: input.workspaceId,
    context: input.context,
  });

  if (access.memberRole === "CLIENT") {
    throw forbidden("Clients cannot create matters");
  }

  const title = input.title.trim();
  if (!title) {
    throw validationError("Matter title is required");
  }

  const matterType = input.matterType ?? "OTHER";
  if (!MATTER_TYPES.includes(matterType)) {
    throw validationError("Invalid matter type");
  }

  const matterId = crypto.randomUUID();
  const now = new Date();

  await db.insert(matters).values({
    id: matterId,
    workspaceId: input.workspaceId,
    title,
    description: input.description?.trim() || null,
    status: "OPEN",
    matterType,
    createdBy: input.context.userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(matterMembers).values({
    id: crypto.randomUUID(),
    matterId,
    userId: input.context.userId,
    role: "LAWYER",
    createdAt: now,
  });

  return serializeMatter({
    id: matterId,
    workspaceId: input.workspaceId,
    title,
    description: input.description?.trim() || null,
    status: "OPEN",
    matterType,
    createdBy: input.context.userId,
    createdAt: now,
    updatedAt: now,
    memberRole: "LAWYER",
  });
}

export async function listMattersForUser(input: {
  workspaceId: string;
  context: AuthContext;
}) {
  await assertWorkspaceAccess({
    workspaceId: input.workspaceId,
    context: input.context,
  });

  const rows = await db
    .select({
      id: matters.id,
      workspaceId: matters.workspaceId,
      title: matters.title,
      description: matters.description,
      status: matters.status,
      matterType: matters.matterType,
      createdBy: matters.createdBy,
      createdAt: matters.createdAt,
      updatedAt: matters.updatedAt,
      memberRole: matterMembers.role,
    })
    .from(matterMembers)
    .innerJoin(matters, eq(matters.id, matterMembers.matterId))
    .where(
      and(
        eq(matterMembers.userId, input.context.userId),
        eq(matters.workspaceId, input.workspaceId),
      ),
    );

  return rows.map(serializeMatter);
}

export async function listAllMattersForUser(context: AuthContext) {
  const rows = await db
    .select({
      id: matters.id,
      workspaceId: matters.workspaceId,
      title: matters.title,
      description: matters.description,
      status: matters.status,
      matterType: matters.matterType,
      createdBy: matters.createdBy,
      createdAt: matters.createdAt,
      updatedAt: matters.updatedAt,
      memberRole: matterMembers.role,
    })
    .from(matterMembers)
    .innerJoin(matters, eq(matters.id, matterMembers.matterId))
    .where(eq(matterMembers.userId, context.userId));

  return rows
    .map(serializeMatter)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getMatterForUser(input: {
  matterId: string;
  context: AuthContext;
}) {
  const rows = await db
    .select({
      id: matters.id,
      workspaceId: matters.workspaceId,
      title: matters.title,
      description: matters.description,
      status: matters.status,
      matterType: matters.matterType,
      createdBy: matters.createdBy,
      createdAt: matters.createdAt,
      updatedAt: matters.updatedAt,
      memberRole: matterMembers.role,
    })
    .from(matterMembers)
    .innerJoin(matters, eq(matters.id, matterMembers.matterId))
    .where(
      and(
        eq(matterMembers.userId, input.context.userId),
        eq(matters.id, input.matterId),
      ),
    )
    .limit(1);

  const matter = rows[0];
  if (!matter) {
    throw forbidden("You do not have access to this matter");
  }

  await assertWorkspaceAccess({
    workspaceId: matter.workspaceId,
    context: input.context,
  });

  return serializeMatter(matter);
}

export async function updateMatter(input: {
  matterId: string;
  context: AuthContext;
  title?: string;
  description?: string | null;
  status?: MatterStatus;
  matterType?: MatterType;
}) {
  const access = await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  if (!canManageMatter(access.memberRole)) {
    throw forbidden("You are not allowed to update this matter");
  }

  const patch: {
    title?: string;
    description?: string | null;
    status?: MatterStatus;
    matterType?: MatterType;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw validationError("Matter title is required");
    }
    patch.title = title;
  }

  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }

  if (input.status !== undefined) {
    if (!MATTER_STATUSES.includes(input.status)) {
      throw validationError("Invalid matter status");
    }
    patch.status = input.status;
  }

  if (input.matterType !== undefined) {
    if (!MATTER_TYPES.includes(input.matterType)) {
      throw validationError("Invalid matter type");
    }
    patch.matterType = input.matterType;
  }

  await db.update(matters).set(patch).where(eq(matters.id, input.matterId));

  return getMatterForUser({
    matterId: input.matterId,
    context: input.context,
  });
}

export async function deleteMatter(input: {
  matterId: string;
  context: AuthContext;
}) {
  const access = await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  if (!canManageMatter(access.memberRole)) {
    throw forbidden("You are not allowed to delete this matter");
  }

  const deleted = await db
    .delete(matters)
    .where(eq(matters.id, input.matterId))
    .returning({ id: matters.id });

  if (!deleted[0]) {
    throw notFound("Matter not found");
  }

  return { deleted: true as const };
}

export async function listMatterParticipants(input: {
  matterId: string;
  context: AuthContext;
}) {
  await assertMatterAccess({
    matterId: input.matterId,
    context: input.context,
  });

  return db
    .select({
      id: matterMembers.id,
      userId: matterMembers.userId,
      role: matterMembers.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: matterMembers.createdAt,
    })
    .from(matterMembers)
    .innerJoin(user, eq(user.id, matterMembers.userId))
    .where(eq(matterMembers.matterId, input.matterId));
}
