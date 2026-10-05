import { createDocumentAgent } from "@/modules/agents/agents/document";
import { createDraftingAgent } from "@/modules/agents/agents/drafting";
import { createResearchAgent } from "@/modules/agents/agents/research";
import { createReviewAgent } from "@/modules/agents/agents/review";
import type { AgentRuntime, LegalAgent } from "@/modules/agents/agents/base";
import type { AgentType } from "@/modules/agents/types";

export function createAgentRoster(runtime: AgentRuntime): Record<
  Exclude<AgentType, "ORCHESTRATOR">,
  LegalAgent
> {
  return {
    RESEARCH: createResearchAgent(runtime),
    DOCUMENT: createDocumentAgent(runtime),
    DRAFTING: createDraftingAgent(runtime),
    REVIEW: createReviewAgent(runtime),
  };
}

export type { LegalAgent, AgentRuntime } from "@/modules/agents/agents/base";
