import { forbidden } from "@/modules/authorization/errors";
import type { AuthContext } from "@/modules/authorization/permissions";
import type { AgentPermissions, AgentType } from "@/modules/agents/types";
import { isWebSearchConfigured } from "@/modules/legal-retrieval/web/providers";

export function buildAgentPermissions(input: {
  context: AuthContext;
  matterRole: "LAWYER" | "CLIENT";
}): AgentPermissions {
  const isLawyer =
    input.context.role === "LAWYER" && input.matterRole === "LAWYER";

  return {
    globalRole: input.context.role,
    matterRole: input.matterRole,
    canRunResearch: isLawyer,
    canRunDocumentAnalysis: true,
    canRunDrafting: isLawyer,
    canRunReview: isLawyer,
    canApprove: isLawyer,
  };
}

export function assertAgentTypeAllowed(
  permissions: AgentPermissions,
  agentType: AgentType,
) {
  if (agentType === "ORCHESTRATOR") {
    return;
  }
  if (agentType === "RESEARCH" && !permissions.canRunResearch) {
    throw forbidden("Clients cannot run the Research Agent");
  }
  if (agentType === "DRAFTING" && !permissions.canRunDrafting) {
    throw forbidden("Clients cannot run the Drafting Agent");
  }
  if (agentType === "REVIEW" && !permissions.canRunReview) {
    throw forbidden("Clients cannot run the Review Agent");
  }
  if (agentType === "DOCUMENT" && !permissions.canRunDocumentAnalysis) {
    throw forbidden("Document analysis is not permitted");
  }
}

export function toolAllowlistForAgent(agentType: AgentType): string[] {
  switch (agentType) {
    case "RESEARCH": {
      const tools = [
        "search_legal_corpus",
        "search_web",
        "retrieve_legal_provision",
        "retrieve_web_source",
        "build_legal_context",
        "retrieve_memory",
        "propose_memory",
      ];
      if (isWebSearchConfigured()) {
        return tools;
      }
      return tools.filter(
        (tool) => tool !== "search_web" && tool !== "retrieve_web_source",
      );
    }
    case "DOCUMENT":
      return [
        "list_matter_documents",
        "search_matter_documents",
        "retrieve_document",
        "retrieve_document_page",
        "search_document_text",
        "retrieve_memory",
        "propose_memory",
      ];
    case "DRAFTING":
      return [
        "build_legal_context",
        "validate_citations",
        "create_draft",
        "request_approval",
        "retrieve_memory",
      ];
    case "REVIEW":
      return [
        "validate_citations",
        "build_legal_context",
        "record_review_findings",
        "retrieve_document",
        "retrieve_memory",
      ];
    case "ORCHESTRATOR":
      return [];
  }
}
