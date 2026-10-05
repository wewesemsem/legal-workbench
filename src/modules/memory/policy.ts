import type { MemorySourceType, MemoryType } from "@/modules/memory/types";

const BLOCKED_KEYS = new Set([
  "chain_of_thought",
  "hidden_reasoning",
  "system_prompt",
  "private_reasoning",
]);

const SPECULATION_PATTERNS = [
  /\bmaybe\b/i,
  /\bpossibly\b/i,
  /\bmight\b/i,
  /\bi think\b/i,
  /\bspeculat/i,
  /\blikely\b/i,
  /\bunsupported\b/i,
];

/**
 * Controlled write policy — agents propose; policy validates.
 */
export function validateMemoryCandidate(input: {
  type: MemoryType;
  key: string;
  value: string;
  sourceType: MemorySourceType;
}): { ok: true } | { ok: false; reason: string } {
  const key = input.key.trim().toLowerCase();
  const value = input.value.trim();

  if (!key || key.length > 120) {
    return { ok: false, reason: "Memory key is invalid" };
  }
  if (!value || value.length > 4_000) {
    return { ok: false, reason: "Memory value is invalid" };
  }
  if (BLOCKED_KEYS.has(key)) {
    return { ok: false, reason: "Chain-of-thought / hidden reasoning cannot be stored" };
  }
  if (/chain.of.thought|hidden reasoning|system prompt/i.test(value)) {
    return { ok: false, reason: "Memory value appears to contain prohibited reasoning content" };
  }
  if (
    input.sourceType === "AI_DERIVED" &&
    SPECULATION_PATTERNS.some((pattern) => pattern.test(value))
  ) {
    return { ok: false, reason: "Temporary speculation is not eligible for persistent memory" };
  }
  if (input.type === "WORKING" && input.sourceType === "LAWYER_CONFIRMED") {
    return { ok: false, reason: "Working memory cannot be lawyer-confirmed" };
  }
  return { ok: true };
}

export function confidenceForSource(sourceType: MemorySourceType): number {
  switch (sourceType) {
    case "LAWYER_CONFIRMED":
      return 1;
    case "USER_PROVIDED":
      return 0.95;
    case "DOCUMENT_DERIVED":
      return 0.8;
    case "CONVERSATION_DERIVED":
      return 0.7;
    case "SYSTEM_DEFINED":
      return 0.9;
    case "AI_DERIVED":
      return 0.6;
  }
}

export function requiresLawyerConfirmation(input: {
  type: MemoryType;
  sourceType: MemorySourceType;
  requireConfirmation?: boolean;
}): boolean {
  if (input.requireConfirmation === false) return false;
  if (input.requireConfirmation === true) return true;
  if (input.type !== "MATTER") return false;
  if (input.sourceType === "LAWYER_CONFIRMED") return false;
  // Consequential matter facts need confirmation unless already lawyer-confirmed.
  return (
    input.sourceType === "AI_DERIVED" ||
    input.sourceType === "DOCUMENT_DERIVED" ||
    input.sourceType === "CONVERSATION_DERIVED" ||
    input.sourceType === "USER_PROVIDED"
  );
}
