import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthContext } from "@/modules/auth/service";
import {
  createMemory,
  listMatterMemory,
  listPendingConflicts,
} from "@/modules/memory";
import { assertMatterAccess } from "@/modules/authorization/permissions";

const createSchema = z
  .object({
    key: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(4_000),
    source_type: z
      .enum([
        "USER_PROVIDED",
        "LAWYER_CONFIRMED",
        "DOCUMENT_DERIVED",
        "CONVERSATION_DERIVED",
        "AI_DERIVED",
        "SYSTEM_DEFINED",
      ])
      .default("USER_PROVIDED"),
    require_confirmation: z.boolean().optional(),
  })
  .strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const url = new URL(request.url);
    const includePending = url.searchParams.get("include_pending") === "1";
    const [items, conflicts] = await Promise.all([
      listMatterMemory({
        matterId,
        context: auth,
        includePending,
      }),
      listPendingConflicts({ matterId, context: auth }),
    ]);
    return jsonOk({
      memories: items.map((item) => ({
        id: item.id,
        key: item.key,
        value: item.value,
        type: item.type,
        source_type: item.sourceType,
        confidence: item.confidence,
        status: item.status,
        confirmed_at: item.confirmedAt,
        confirmed_by: item.confirmedBy,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
      conflicts: conflicts.map((conflict) => ({
        id: conflict.id,
        existing_memory_id: conflict.existingMemoryId,
        proposed_key: conflict.proposedKey,
        proposed_value: conflict.proposedValue,
        proposed_source_type: conflict.proposedSourceType,
        status: conflict.status,
        created_at: conflict.createdAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
) {
  try {
    const auth = await requireAuthContext(request);
    const { matterId } = await context.params;
    const access = await assertMatterAccess({ matterId, context: auth });
    const body = createSchema.parse(await request.json());

    const result = await createMemory({
      data: {
        workspaceId: access.workspaceId,
        matterId,
        type: "MATTER",
        key: body.key,
        value: body.value,
        sourceType: body.source_type,
        // Manual lawyer UI creates can skip pending confirmation.
        requireConfirmation:
          body.require_confirmation ??
          (body.source_type === "LAWYER_CONFIRMED" ? false : true),
      },
      context: auth,
    });

    // Lawyer-authored active matter facts become LAWYER_CONFIRMED when confirmed path is skipped.
    if (
      result.status === "CREATED" &&
      auth.role === "LAWYER" &&
      body.source_type === "USER_PROVIDED" &&
      body.require_confirmation === false
    ) {
      const { confirmMemory } = await import("@/modules/memory");
      const confirmed = await confirmMemory({
        memoryId: result.memory.id,
        context: auth,
      });
      return jsonOk({
        status: "CREATED",
        memory: {
          id: confirmed.id,
          key: confirmed.key,
          value: confirmed.value,
          source_type: confirmed.sourceType,
          status: confirmed.status,
          confidence: confirmed.confidence,
        },
      });
    }

    if (result.status === "REJECTED") {
      return jsonOk({ status: result.status, reason: result.reason }, { status: 400 });
    }
    if (result.status === "CONFLICT_DETECTED") {
      return jsonOk({
        status: result.status,
        conflict: {
          id: result.conflict.id,
          proposed_key: result.proposed.key,
          proposed_value: result.proposed.value,
          existing_value: result.existing.value,
        },
      });
    }

    return jsonOk({
      status: result.status,
      memory: {
        id: result.memory.id,
        key: result.memory.key,
        value: result.memory.value,
        source_type: result.memory.sourceType,
        status: result.memory.status,
        confidence: result.memory.confidence,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
