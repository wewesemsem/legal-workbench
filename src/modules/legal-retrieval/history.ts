import { db } from "@/lib/db";
import { researchRuns, researchSources } from "@/lib/db/schema";
import type {
  ResearchSourceMode,
  ResearchSourceRecord,
} from "@/modules/legal-retrieval/types";

export async function persistResearchRun(input: {
  workspaceId: string;
  matterId: string;
  userId: string;
  query: string;
  sourceMode: ResearchSourceMode;
  researchSources: ResearchSourceRecord[];
  metadata: Record<string, unknown>;
}): Promise<string> {
  const runId = crypto.randomUUID();
  await db.insert(researchRuns).values({
    id: runId,
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    userId: input.userId,
    query: input.query,
    sourceMode: input.sourceMode,
    metadata: input.metadata,
    createdAt: new Date(),
  });

  if (input.researchSources.length) {
    await db.insert(researchSources).values(
      input.researchSources.map((source) => ({
        id: crypto.randomUUID(),
        researchRunId: runId,
        url: source.url,
        title: source.title,
        sourceType: source.sourceType,
        authorityStatus: source.authorityStatus,
        sourceStatus: source.sourceStatus,
        domain: source.domain,
        publishedAt: source.publishedAt,
        retrievedAt: source.retrievedAt ? new Date(source.retrievedAt) : null,
        relevanceScore: source.relevanceScore,
        excerpt: source.excerpt,
        createdAt: new Date(),
      })),
    );
  }

  console.error("[web-research] history saved", {
    researchRunId: runId,
    matterId: input.matterId,
    sources: input.researchSources.length,
    mode: input.sourceMode,
  });

  return runId;
}
