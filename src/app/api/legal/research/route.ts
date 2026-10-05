import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAuthContext } from "@/modules/auth/service";
import { forbidden, rateLimited } from "@/modules/authorization/errors";
import { runLegalResearch } from "@/modules/legal-retrieval/research";

const filtersSchema = z
  .object({
    country: z.string().trim().max(2).optional(),
    jurisdiction: z.string().trim().max(120).optional(),
    language: z.string().trim().max(8).optional(),
    documentType: z
      .enum([
        "CONSTITUTION",
        "LEGISLATION",
        "REGULATION",
        "JUDGMENT",
        "JUDGMENT_SUMMARY",
        "CONSTITUTIONAL_JUDGMENT",
        "LEGISLATIVE_HISTORY",
        "PARLIAMENTARY_DOCUMENT",
        "OFFICIAL_DECISION",
        "HISTORICAL_LEGAL_MATERIAL",
        "OTHER",
      ])
      .optional(),
    authorityStatus: z.literal("AUTHORITATIVE_SOURCE").optional(),
    contentType: z.enum(["SOURCE_TEXT", "OCR"]).optional(),
    legalDocumentId: z.string().trim().max(80).optional(),
  })
  .strict();

const bodySchema = z
  .object({
    query: z.string().trim().min(1).max(4_000),
    source_mode: z.enum(["CORPUS", "WEB", "BOTH"]).default("CORPUS"),
    matter_id: z.string().trim().min(1).max(80).optional(),
    debug: z.boolean().optional(),
    filters: filtersSchema.optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const env = getEnv();
    const limit = checkRateLimit(
      `legal-research:${auth.userId}:${getClientIp(request.headers)}`,
      env.CHAT_RATE_LIMIT_MAX_ATTEMPTS,
      env.CHAT_RATE_LIMIT_WINDOW_MS,
    );
    if (!limit.allowed) {
      throw rateLimited();
    }

    const body = bodySchema.parse(await request.json());
    if (body.debug && auth.role !== "LAWYER") {
      throw forbidden("Retrieval debugging is limited to lawyers");
    }

    const result = await runLegalResearch({
      query: body.query,
      sourceMode: body.source_mode,
      matterId: body.matter_id,
      auth,
      filters: body.filters,
      debug: body.debug === true && auth.role === "LAWYER",
    });

    return jsonOk({
      answer: result.answer,
      evidence: result.evidence.map((item) => ({
        sourceKind: item.sourceKind,
        chunkId: item.chunkId,
        documentId: item.documentId,
        provisionId: item.provisionId,
        title: item.title,
        heading: item.heading,
        provisionType: item.provisionType,
        provisionNumber: item.provisionNumber,
        text: item.text,
        score: item.score,
        sourceUrl: item.sourceUrl,
        authorityStatus: item.authorityStatus,
        language: item.language,
        hierarchyPath: item.hierarchyPath,
        documentType: item.documentType,
        domain: item.domain ?? null,
        sourceName: item.sourceName ?? item.issuingAuthority,
        publishedAt: item.publishedAt ?? item.date ?? null,
        retrievedAt: item.retrievedAt ?? null,
        webAuthority: item.webAuthority ?? null,
        sourceStatus: item.sourceStatus ?? null,
      })),
      citations: result.citations,
      research_sources: result.researchSources,
      evidenceSufficient: result.evidenceSufficient,
      limitation: result.limitation,
      source_mode: result.sourceMode,
      research_run_id: result.researchRunId,
      metadata: result.metadata,
      ...(result.debug ? { debug: result.debug } : {}),
    });
  } catch (error) {
    return jsonError(error);
  }
}
