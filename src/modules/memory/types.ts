export type MemoryType =
  | "WORKING"
  | "CONVERSATION"
  | "MATTER"
  | "USER_PREFERENCE"
  | "WORKSPACE_PREFERENCE";

export type MemorySourceType =
  | "USER_PROVIDED"
  | "LAWYER_CONFIRMED"
  | "DOCUMENT_DERIVED"
  | "CONVERSATION_DERIVED"
  | "AI_DERIVED"
  | "SYSTEM_DEFINED";

export type MemoryStatus =
  | "ACTIVE"
  | "ARCHIVED"
  | "DELETED"
  | "PENDING_CONFIRMATION";

export type MemoryConflictStatus =
  | "PENDING"
  | "RESOLVED_KEEP_EXISTING"
  | "RESOLVED_USE_PROPOSED"
  | "RESOLVED_EDITED"
  | "CANCELLED";

export type MemoryRecord = {
  id: string;
  workspaceId: string;
  matterId: string | null;
  userId: string | null;
  conversationId: string | null;
  type: MemoryType;
  key: string;
  value: string;
  sourceType: MemorySourceType;
  sourceId: string | null;
  confidence: number;
  status: MemoryStatus;
  metadata: Record<string, unknown>;
  expiresAt: Date | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MemoryConflictRecord = {
  id: string;
  workspaceId: string;
  matterId: string | null;
  existingMemoryId: string;
  proposedKey: string;
  proposedValue: string;
  proposedSourceType: MemorySourceType;
  proposedSourceId: string | null;
  status: MemoryConflictStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateMemoryInput = {
  workspaceId: string;
  matterId?: string | null;
  userId?: string | null;
  conversationId?: string | null;
  type: MemoryType;
  key: string;
  value: string;
  sourceType: MemorySourceType;
  sourceId?: string | null;
  confidence?: number;
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
  requireConfirmation?: boolean;
};

export type MemoryWriteResult =
  | { status: "CREATED"; memory: MemoryRecord }
  | { status: "UPDATED"; memory: MemoryRecord }
  | { status: "PENDING_CONFIRMATION"; memory: MemoryRecord }
  | {
      status: "CONFLICT_DETECTED";
      conflict: MemoryConflictRecord;
      existing: MemoryRecord;
      proposed: { key: string; value: string; sourceType: MemorySourceType };
    }
  | { status: "REJECTED"; reason: string };

export type RetrievedMemoryBundle = {
  working: MemoryRecord[];
  conversation: Array<{ role: string; content: string; createdAt: Date }>;
  matter: MemoryRecord[];
  userPreferences: MemoryRecord[];
  workspacePreferences: MemoryRecord[];
  resolvedInstructions: {
    language?: string;
    draftingStyle?: string;
    citationStyle?: string;
    tone?: string;
    outputStructure?: string;
  };
  conflicts: MemoryConflictRecord[];
};

/** Provenance rank for factual precedence (higher wins / cannot be silently overwritten). */
export const SOURCE_PRECEDENCE: Record<MemorySourceType, number> = {
  LAWYER_CONFIRMED: 100,
  USER_PROVIDED: 80,
  DOCUMENT_DERIVED: 60,
  CONVERSATION_DERIVED: 40,
  AI_DERIVED: 20,
  SYSTEM_DEFINED: 10,
};
