import type { Locale } from "@/modules/i18n/config";
import type { Messages } from "@/modules/i18n/messages";

function looksArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function looksMostlyEnglish(text: string) {
  return /[A-Za-z]/.test(text) && !looksArabic(text);
}

function localizeDraftTitle(title: string, t: Messages, locale: Locale) {
  const trimmed = title.trim();
  if (!trimmed) return t.aiDraftDefaultTitle;
  if (locale === "ar" && looksMostlyEnglish(trimmed)) {
    return t.aiDraftDefaultTitle;
  }
  if (
    locale === "fr" &&
    looksMostlyEnglish(trimmed) &&
    /response letter|demand letter|employment/i.test(trimmed)
  ) {
    return t.aiDraftDefaultTitle;
  }
  return trimmed;
}

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
  locale: Locale = "en",
) {
  const summary = step.summary?.trim() ?? "";
  const action = (step.action ?? "").toLowerCase();
  const tool = (step.tool ?? "").toLowerCase();
  const agent = (step.agentType ?? "").toUpperCase();
  const running =
    step.status === "RUNNING" || step.status === "PENDING";
  const isDraftTool =
    tool === "create_draft" ||
    action.includes("create_draft") ||
    /create_draft|created draft|إنشاء المسودة|تم إنشاء المسودة/i.test(
      summary,
    );

  const draftQuoted =
    summary.match(
      /(?:create_draft|Created draft|تم إنشاء المسودة)\s*:?\s*(?:draft\s*|مسودة\s*)?[«"]([^»"]+)[»"]/i,
    ) ??
    summary.match(/(?:create_draft|Created draft)\s*:?\s*(?:draft\s*)?(.+)$/i);
  const draftPlain = summary.match(/^Created draft:\s*(.+)$/i);
  if (isDraftTool || draftQuoted?.[1] || draftPlain?.[1]) {
    const rawTitle = (draftQuoted?.[1] ?? draftPlain?.[1] ?? "").trim();
    const title = localizeDraftTitle(rawTitle, t, locale);
    return t.aiStepDraftCreated.replace("{title}", title);
  }

  if (
    /request_approval|approval requested|طُلبت الموافقة/i.test(summary) ||
    tool === "request_approval"
  ) {
    return t.aiStepApprovalRequested;
  }

  if (
    tool === "search_legal_corpus" ||
    /search(?:ed|ing)? legal corpus/i.test(summary)
  ) {
    return running ? t.aiStepSearchingCorpus : t.aiStepSearchedCorpus;
  }
  if (
    tool === "retrieve_legal_provision" ||
    /retriev(?:ed|ing) legal provision/i.test(summary)
  ) {
    return running ? t.aiStepRetrievingProvision : t.aiStepRetrievedProvision;
  }
  if (tool === "search_web" || /search(?:ed|ing)? the web/i.test(summary)) {
    return running ? t.aiStepSearchingWeb : t.aiStepSearchedWeb;
  }
  if (tool === "build_legal_context") {
    return t.aiStepBuildContext;
  }
  if (tool === "validate_citations") {
    return t.aiStepValidateCitations;
  }
  if (tool === "retrieve_memory" || /memory/i.test(tool)) {
    return t.matterContext;
  }

  if (action.includes("conversation.resolve")) {
    // Show the concrete resolve note when available ("Identified target: Article 1").
    if (
      summary &&
      summary.trim() &&
      summary.trim() !== "Understood conversation context"
    ) {
      return summary.trim();
    }
    return t.aiStepConversationContext;
  }
  if (action.includes("research.validate_evidence")) {
    return t.aiStepValidateEvidence;
  }
  if (action.includes("research.retrieved_target")) {
    return t.aiStepRetrievedTarget;
  }
  if (action.includes("research.target")) {
    return t.aiStepResearchTarget;
  }
  if (action.includes("research.retry")) {
    return t.aiStepRetryRetrieval;
  }

  // Prefer localized labels over raw English server summaries.
  if (
    summary &&
    (looksArabic(summary) ||
      (locale === "fr" && !looksMostlyEnglish(summary)))
  ) {
    return summary;
  }

  if (
    action.includes("research") ||
    tool.includes("research") ||
    agent === "RESEARCH"
  ) {
    return running ? t.researching : t.researchAnIssue;
  }
  if (action.includes("review") || agent === "REVIEW") {
    return running ? t.statusThinking : t.aiStepReviewedFindings;
  }
  if (
    action.includes("draft") ||
    tool.includes("draft") ||
    agent === "DRAFTING"
  ) {
    return running ? t.aiStepDrafting : t.draftSomething;
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

  // In Arabic UI, never surface raw English tool chatter.
  if (locale === "ar") {
    return running ? t.workingOnRequest : t.statusWorking;
  }

  if (summary && !looksMostlyEnglish(summary)) {
    return summary;
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

export function approvalActionLabel(action: string, t: Messages) {
  switch (action) {
    case "create_draft":
      return t.aiStepApprovalCreateDraft;
    case "save_matter_memory":
      return t.aiStepApprovalSaveMemory;
    default:
      return action.replaceAll("_", " ");
  }
}
