import type { MatterStatus, MatterType } from "@/modules/matters/types";

/**
 * Authorized, LLM-safe matter context.
 * Never pass raw DB rows or document OCR text through this object in Phase 1.
 */
export type MatterContext = {
  matter: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    type: MatterType;
    status: MatterStatus;
  };
  participants: Array<{
    userId: string;
    role: "LAWYER" | "CLIENT";
    displayName: string;
  }>;
  documents: Array<{
    id: string;
    filename: string;
    mimeType: string;
    processingStatus: "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";
    pageCount: number | null;
  }>;
  conversation: {
    id: string;
    title: string;
    recentMessages: Array<{
      id: string;
      role: "USER" | "ASSISTANT" | "SYSTEM";
      content: string;
      createdAt: Date;
    }>;
  } | null;
  permissions: {
    memberRole: "LAWYER" | "CLIENT";
    canUploadDocuments: boolean;
    canDeleteDocuments: boolean;
    /**
     * Reserved for future visibility levels (PUBLIC_TO_MATTER / LAWYER_ONLY / OWNER_ONLY).
     * Phase 1 only exposes matter-scoped public metadata.
     */
    visibility: "PUBLIC_TO_MATTER";
  };
  /**
   * Explicitly separates context layers for future RAG wiring.
   * Retrieved context slots stay empty until Matter/Legal RAG is implemented.
   */
  layers: {
    matterContext: true;
    matterRag: false;
    legalCorpusRag: false;
    explicitUserContext: string[];
  };
};
