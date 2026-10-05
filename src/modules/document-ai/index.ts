import { getEnv } from "@/lib/env";
import { createGoogleDocumentAiService } from "@/modules/document-ai/google";
import { createMockDocumentAiService } from "@/modules/document-ai/mock";
import type { DocumentAiService } from "@/modules/document-ai/types";

let cached: DocumentAiService | null = null;

export function getDocumentAiService(): DocumentAiService {
  if (cached) {
    return cached;
  }

  const env = getEnv();
  cached =
    env.DOCUMENT_AI_PROVIDER === "google"
      ? createGoogleDocumentAiService()
      : createMockDocumentAiService();
  return cached;
}

export function resetDocumentAiServiceForTests(service?: DocumentAiService) {
  cached = service ?? null;
}

export type {
  DocumentAiProcessResult,
  DocumentAiService,
} from "@/modules/document-ai/types";
