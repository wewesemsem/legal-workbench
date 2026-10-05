import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { getEnv } from "@/lib/env";
import {
  forbidden,
  unauthenticated,
  validationError,
} from "@/modules/authorization/errors";
import {
  discoverAndIngestAll,
  getCorpusStats,
  listIngestionRuns,
  listLegalSources,
  seedLegalSources,
  setSourceEnabled,
} from "@/modules/legal-corpus/service";

function assertCorpusAdmin(request: Request) {
  const env = getEnv();
  const token = env.LEGAL_CORPUS_ADMIN_TOKEN;
  if (!token) {
    throw forbidden("Legal corpus admin API is disabled");
  }
  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : request.headers.get("x-corpus-admin-token");
  if (!provided) {
    throw unauthenticated("Corpus admin token required");
  }
  if (provided !== token) {
    throw forbidden("Invalid corpus admin token");
  }
}

export async function GET(request: Request) {
  try {
    assertCorpusAdmin(request);
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "sources";
    if (view === "stats") {
      return jsonOk({ stats: await getCorpusStats() });
    }
    if (view === "runs") {
      return jsonOk({ runs: await listIngestionRuns() });
    }
    return jsonOk({ sources: await listLegalSources() });
  } catch (error) {
    return jsonError(error);
  }
}

const postSchema = z.object({
  action: z.enum(["seed", "run", "enable", "disable"]),
  sourceId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    assertCorpusAdmin(request);
    const body = postSchema.parse(await request.json());
    if (body.action === "seed") {
      return jsonOk({ sources: await seedLegalSources() });
    }
    if (body.action === "run") {
      await seedLegalSources();
      const results = await discoverAndIngestAll(10);
      return jsonOk({ results, stats: await getCorpusStats() });
    }
    if (!body.sourceId) {
      throw validationError("sourceId is required");
    }
    const source = await setSourceEnabled({
      sourceId: body.sourceId,
      enabled: body.action === "enable",
    });
    return jsonOk({ source });
  } catch (error) {
    return jsonError(error);
  }
}
