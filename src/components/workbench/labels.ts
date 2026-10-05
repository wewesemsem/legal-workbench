import type { Messages } from "@/modules/i18n/messages";

export function matterStatusLabel(status: string, t: Messages) {
  switch (status) {
    case "OPEN":
      return t.statusActive;
    case "CLOSED":
      return t.statusClosed;
    case "ARCHIVED":
      return t.statusArchived;
    default:
      return status;
  }
}

export function documentStatusLabel(status: string, t: Messages) {
  switch (status) {
    case "UPLOADED":
      return t.statusUploading;
    case "PROCESSING":
      return t.statusProcessing;
    case "READY":
    case "PROCESSED":
    case "COMPLETED":
    case "INDEXED":
      return t.statusReady;
    case "FAILED":
      return t.statusFailed;
    case "NEEDS_ATTENTION":
      return t.statusNeedsAttention;
    default:
      return status;
  }
}

export function aiStatusLabel(status: string, t: Messages) {
  switch (status) {
    case "PLANNING":
      return t.statusThinking;
    case "RUNNING":
      return t.statusWorking;
    case "WAITING_FOR_APPROVAL":
      return t.statusWaitingApproval;
    case "COMPLETED":
      return t.statusComplete;
    case "FAILED":
      return t.statusFailed;
    case "CANCELLED":
      return t.statusCancelled;
    case "INCOMPLETE":
      return t.statusIncomplete;
    default:
      return status;
  }
}

export function humanizeStep(
  step: {
    agentType?: string;
    action?: string;
    tool?: string | null;
    summary?: string;
    status?: string;
  },
  t: Messages,
) {
  if (
    step.summary &&
    !/toolregistry|embedding|planner|gateway/i.test(step.summary)
  ) {
    return step.summary;
  }

  const action = (step.action ?? "").toLowerCase();
  const tool = (step.tool ?? "").toLowerCase();
  const agent = (step.agentType ?? "").toUpperCase();
  const running =
    step.status === "RUNNING" || step.status === "PENDING";

  if (tool === "search_legal_corpus") {
    return running ? "Searching legal corpus…" : "Searched legal corpus";
  }
  if (tool === "retrieve_legal_provision") {
    return running
      ? "Retrieving legal provision…"
      : "Retrieved legal provision";
  }
  if (action.includes("conversation.resolve")) {
    return step.summary?.trim() || "Understood conversation context";
  }
  if (action.includes("research.validate_evidence")) {
    return step.summary?.trim() || "Validated evidence";
  }
  if (action.includes("research.retrieved_target")) {
    return step.summary?.trim() || "Retrieved target provision";
  }
  if (action.includes("research.target")) {
    return step.summary?.trim() || "Identified research target";
  }
  if (tool === "search_web") {
    return running ? "Searching the web…" : "search_web";
  }

  if (
    action.includes("research") ||
    tool.includes("research") ||
    agent === "RESEARCH"
  ) {
    return running ? t.researching : t.researchAnIssue;
  }
  if (action.includes("review") || agent === "REVIEW") {
    return t.reviewADocument;
  }
  if (
    action.includes("draft") ||
    tool.includes("draft") ||
    agent === "DRAFTING"
  ) {
    return t.draftSomething;
  }
  if (
    action.includes("document") ||
    tool.includes("matter") ||
    agent === "DOCUMENT"
  ) {
    return t.reviewDocument;
  }
  if (action.includes("memory") || tool.includes("memory")) {
    return t.matterContext;
  }
  if (action.includes("plan") || agent === "ORCHESTRATOR") {
    return running ? t.researching : t.statusThinking;
  }
  return running ? t.workingOnRequest : t.statusWorking;
}

export function provenanceLabel(source: string, t: Messages) {
  switch (source) {
    case "LAWYER_CONFIRMED":
      return t.provenanceConfirmed;
    case "USER_PROVIDED":
      return t.provenanceUser;
    case "DOCUMENT_DERIVED":
      return t.provenanceDocument;
    case "CONVERSATION_DERIVED":
      return t.provenanceConversation;
    case "AI_DERIVED":
      return t.provenanceAi;
    case "SYSTEM_DEFINED":
      return t.provenanceSystem;
    default:
      return source;
  }
}

export function sourceTypeLabel(kind: string, t: Messages) {
  switch (kind) {
    case "PRIMARY_OFFICIAL":
    case "OFFICIAL_GOVERNMENT":
    case "OFFICIAL_PARLIAMENT":
    case "OFFICIAL":
      return t.sourceOfficial;
    case "OFFICIAL_COURT":
    case "COURT":
      return t.sourceCourt;
    case "LEGISLATION":
    case "LEGAL_CORPUS":
      return t.sourceLegislation;
    case "MATTER_DOCUMENT":
      return t.sourceMatterDocument;
    case "WEB":
    case "GENERAL_WEB":
    case "SECONDARY":
      return t.sourceWeb;
    default:
      return kind.replaceAll("_", " ");
  }
}

export function roleLabel(role: string, t: Messages) {
  switch (role) {
    case "LAWYER":
      return t.lawyer;
    case "CLIENT":
      return t.client;
    case "OWNER":
      return t.lawyer;
    default:
      return role;
  }
}
