import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAuthContext } from "@/modules/auth/service";
import { forbidden, rateLimited } from "@/modules/authorization/errors";
import { askLegalQuestion } from "@/modules/legal-retrieval/answer";

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
    debug: z.boolean().optional(),
    filters: filtersSchema.optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const env = getEnv();
    const limit = checkRateLimit(
      `legal-ask:${auth.userId}:${getClientIp(request.headers)}`,
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

    const result = await askLegalQuestion({
      query: body.query,
      filters: body.filters,
      debug: body.debug === true && auth.role === "LAWYER",
    });

    return jsonOk({
      answer: result.answer,
      citations: result.citations,
      evidenceSufficient: result.evidenceSufficient,
      limitation: result.limitation,
      ...(result.debug ? { debug: result.debug } : {}),
    });
  } catch (error) {
    return jsonError(error);
  }
}
