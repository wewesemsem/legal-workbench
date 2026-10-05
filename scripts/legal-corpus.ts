import "dotenv/config";

import {
  formatImportReport,
  importLegalManifest,
} from "@/modules/legal-corpus/import";
import { askLegalQuestion } from "@/modules/legal-retrieval/answer";
import { runLegalRetrievalEval } from "@/modules/legal-retrieval/eval";
import { indexApprovedAuthoritativeDocuments } from "@/modules/legal-retrieval/index-corpus";
import {
  approveLegalDocument,
  discoverAndIngestAll,
  discoverSource,
  dryRunOfficialIngest,
  getCorpusStats,
  ingestSource,
  listFailedDiscoveries,
  listIngestionRuns,
  listLegalSources,
  resolveSourceIdAlias,
  seedLegalSources,
  setSourceEnabled,
  validateLegalDocument,
} from "@/modules/legal-corpus/service";

function usage() {
  console.log(`Legal corpus CLI

Usage:
  npm run corpus -- seed
  npm run corpus -- sources
  npm run corpus -- enable <sourceId>
  npm run corpus -- disable <sourceId>
  npm run corpus -- discover [sourceId|alias]
  npm run corpus -- ingest [sourceId|alias] [--dry-run]
  npm run corpus -- run              # fixture discover+ingest (dev samples)
  npm run corpus -- import --manifest <path> [--dry-run]
  npm run corpus -- validate <documentId>
  npm run corpus -- approve <documentId> [note...]
  npm run corpus -- status
  npm run corpus -- runs
  npm run corpus -- failures
  npm run corpus -- stats
  npm run corpus -- index
  npm run corpus -- ask <question>
  npm run corpus -- eval

Official aliases:
  parliament-constitution
  scc-public
  amiri-public
  parliament-public
`);
}

function parseImportArgs(argv: string[]) {
  let manifest: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--manifest" || token === "-m") {
      manifest = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
    }
  }
  return { manifest, dryRun };
}

function parseIngestArgs(argv: string[]) {
  let sourceId: string | undefined;
  let dryRun = false;
  for (const token of argv) {
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (token === "--manifest" || token === "-m") {
      continue;
    }
    if (!sourceId && !token.startsWith("--")) {
      sourceId = token;
    }
  }
  return { sourceId, dryRun };
}

async function main() {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }

  switch (command) {
    case "seed": {
      const sources = await seedLegalSources();
      console.log(JSON.stringify({ seeded: sources.length, sources }, null, 2));
      break;
    }
    case "sources": {
      console.log(JSON.stringify(await listLegalSources(), null, 2));
      break;
    }
    case "enable":
    case "disable": {
      const sourceId = rest[0] ? resolveSourceIdAlias(rest[0]) : undefined;
      if (!sourceId) {
        throw new Error("sourceId is required");
      }
      console.log(
        JSON.stringify(
          await setSourceEnabled({
            sourceId,
            enabled: command === "enable",
          }),
          null,
          2,
        ),
      );
      break;
    }
    case "discover": {
      await seedLegalSources();
      const sourceId = rest[0]
        ? resolveSourceIdAlias(rest[0])
        : undefined;
      if (sourceId) {
        console.log(JSON.stringify(await discoverSource(sourceId), null, 2));
      } else {
        const sources = await listLegalSources();
        for (const source of sources.filter((item) => item.ingestionEnabled)) {
          console.log(
            JSON.stringify(
              { sourceId: source.id, ...(await discoverSource(source.id)) },
              null,
              2,
            ),
          );
        }
      }
      break;
    }
    case "ingest": {
      if (rest.includes("--manifest") || rest.includes("-m")) {
        const { manifest, dryRun } = parseImportArgs(rest);
        if (!manifest) {
          throw new Error("--manifest <path> is required");
        }
        const report = await importLegalManifest({
          manifestPath: manifest,
          dryRun,
        });
        console.log(formatImportReport(report));
        console.log("");
        console.log(JSON.stringify(report, null, 2));
        break;
      }

      const { sourceId: rawSourceId, dryRun } = parseIngestArgs(rest);
      if (dryRun) {
        if (!rawSourceId) {
          throw new Error("sourceId/alias is required with --dry-run");
        }
        console.log(
          JSON.stringify(await dryRunOfficialIngest(rawSourceId), null, 2),
        );
        break;
      }

      await seedLegalSources();
      const sourceId = rawSourceId
        ? resolveSourceIdAlias(rawSourceId)
        : undefined;
      if (sourceId) {
        await discoverSource(sourceId);
        console.log(JSON.stringify(await ingestSource(sourceId), null, 2));
      } else {
        const sources = await listLegalSources();
        for (const source of sources.filter((item) => item.ingestionEnabled)) {
          console.log(
            JSON.stringify(
              { sourceId: source.id, ...(await ingestSource(source.id)) },
              null,
              2,
            ),
          );
        }
      }
      break;
    }
    case "import": {
      const { manifest, dryRun } = parseImportArgs(rest);
      if (!manifest) {
        throw new Error("--manifest <path> is required");
      }
      const report = await importLegalManifest({
        manifestPath: manifest,
        dryRun,
      });
      console.log(formatImportReport(report));
      console.log("");
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    case "validate": {
      const documentId = rest[0];
      if (!documentId) {
        throw new Error("documentId is required");
      }
      const result = await validateLegalDocument(documentId);
      console.log(result.report);
      console.log("");
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "approve": {
      const documentId = rest[0];
      if (!documentId) {
        throw new Error("documentId is required");
      }
      const note = rest.slice(1).join(" ") || undefined;
      console.log(
        JSON.stringify(await approveLegalDocument({ documentId, note }), null, 2),
      );
      break;
    }
    case "status":
    case "stats": {
      console.log(JSON.stringify(await getCorpusStats(), null, 2));
      break;
    }
    case "run": {
      await seedLegalSources();
      const results = await discoverAndIngestAll(10);
      const stats = await getCorpusStats();
      console.log(JSON.stringify({ results, stats }, null, 2));
      break;
    }
    case "runs": {
      console.log(JSON.stringify(await listIngestionRuns(), null, 2));
      break;
    }
    case "failures": {
      console.log(JSON.stringify(await listFailedDiscoveries(), null, 2));
      break;
    }
    case "index": {
      const results = await indexApprovedAuthoritativeDocuments();
      console.log(
        JSON.stringify(
          {
            indexed: results.length,
            results: results.map((result) => ({
              documentId: result.documentId,
              provisions: result.provisions,
              chunks: result.chunks,
              embedded: result.embedded,
              reused: result.reused,
              embeddingModel: result.embeddingModel,
            })),
          },
          null,
          2,
        ),
      );
      break;
    }
    case "ask": {
      const question = rest.join(" ").trim();
      if (!question) {
        throw new Error("A question is required");
      }
      const result = await askLegalQuestion({ query: question, debug: true });
      console.log(result.answer);
      console.log("");
      console.log(
        JSON.stringify(
          {
            evidenceSufficient: result.evidenceSufficient,
            limitation: result.limitation,
            citations: result.citations.map((citation) => ({
              document: citation.documentTitle,
              provision: citation.provisionLabel,
              source: citation.sourceName,
              sourceUrl: citation.sourceUrl,
              chunkId: citation.legalChunkId,
              score: citation.retrievalScore,
            })),
            debug: result.debug
              ? {
                  ranking: result.debug.ranking,
                  expandedTerms: result.debug.expandedTerms,
                  keyword: result.debug.keywordResults.slice(0, 5).map((hit) => ({
                    provisionNumber: hit.provisionNumber,
                    rawKeywordScore: hit.rawKeywordScore,
                    score: hit.score,
                  })),
                  vector: result.debug.vectorResults.slice(0, 5).map((hit) => ({
                    provisionNumber: hit.provisionNumber,
                    rawVectorScore: hit.rawVectorScore,
                    score: hit.score,
                  })),
                  merged: result.debug.mergedResults.slice(0, 5).map((hit) => ({
                    provisionNumber: hit.provisionNumber,
                    keywordScore: hit.keywordScore,
                    vectorScore: hit.vectorScore,
                    boost: hit.boost,
                    boostBreakdown: hit.boostBreakdown,
                    hybridScore: hit.score,
                  })),
                }
              : null,
          },
          null,
          2,
        ),
      );
      break;
    }
    case "eval": {
      const report = await runLegalRetrievalEval();
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) {
        process.exitCode = 1;
      }
      break;
    }
    default:
      usage();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
