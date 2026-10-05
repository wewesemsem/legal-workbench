/**
 * Deterministic evaluation cases for Agent Memory.
 * These are assertions/helpers for tests — not a separate runtime.
 */

export type MemoryEvalCase = {
  id: string;
  category:
    | "retrieval"
    | "writing"
    | "provenance"
    | "security"
    | "conflict"
    | "injection";
  description: string;
  expect: string;
};

export const MEMORY_EVAL_CASES: MemoryEvalCase[] = [
  {
    id: "mem-retrieve-matter",
    category: "retrieval",
    description: "Correct matter memory retrieved for active matter",
    expect: "matter memory included; irrelevant keys excluded",
  },
  {
    id: "mem-retrieve-cross-matter",
    category: "security",
    description: "Cross-matter memory blocked",
    expect: "Matter A memory never appears in Matter B context",
  },
  {
    id: "mem-retrieve-cross-workspace",
    category: "security",
    description: "Cross-workspace memory blocked",
    expect: "Workspace A memory inaccessible from Workspace B",
  },
  {
    id: "mem-write-stable",
    category: "writing",
    description: "Stable fact becomes memory proposal",
    expect: "Remember that → PENDING_CONFIRMATION proposal",
  },
  {
    id: "mem-write-speculation",
    category: "writing",
    description: "AI speculation rejected",
    expect: "likely/maybe AI_DERIVED values rejected by policy",
  },
  {
    id: "mem-prov-user",
    category: "provenance",
    description: "User provided provenance",
    expect: "source_type=USER_PROVIDED",
  },
  {
    id: "mem-prov-confirmed",
    category: "provenance",
    description: "Lawyer confirmation upgrades provenance",
    expect: "source_type=LAWYER_CONFIRMED; agents cannot self-confirm",
  },
  {
    id: "mem-conflict",
    category: "conflict",
    description: "Confirmed fact + conflicting propose",
    expect: "CONFLICT_DETECTED; no silent overwrite",
  },
  {
    id: "mem-injection",
    category: "injection",
    description: "Prompt injection in memory treated as data",
    expect: "memory wrapped in <memory_context>; not elevated to instructions",
  },
];
