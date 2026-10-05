export {
  createMemory,
  confirmMemory,
  updateMemory,
  archiveMemory,
  deleteMemory,
  getMemoryById,
  listMatterMemory,
  listPendingConflicts,
  resolveMemoryConflict,
  searchMemory,
  retrieveRelevantMemory,
  formatMemoryForAgentContext,
  extractMemoryProposalFromTask,
} from "@/modules/memory/service";
export {
  validateMemoryCandidate,
  confidenceForSource,
  requiresLawyerConfirmation,
} from "@/modules/memory/policy";
export type {
  MemoryRecord,
  MemoryType,
  MemorySourceType,
  MemoryWriteResult,
  RetrievedMemoryBundle,
  MemoryConflictRecord,
} from "@/modules/memory/types";
export { SOURCE_PRECEDENCE } from "@/modules/memory/types";
