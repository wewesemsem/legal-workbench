"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/modules/i18n/provider";
import type { Messages } from "@/modules/i18n/messages";

type CitationKind = "LEGAL_CORPUS" | "WEB" | "MATTER_DOCUMENT";
type SourceMode = "CORPUS" | "WEB" | "BOTH";

type Citation = {
  citationKind?: CitationKind;
  legalDocumentId: string;
  legalProvisionId: string;
  legalChunkId: string;
  sourceUrl: string | null;
  retrievalScore: number;
  documentTitle: string;
  provisionLabel: string;
  sourceName: string;
  marker: string;
  domain?: string | null;
  webAuthority?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
  excerpt?: string | null;
};

type ResearchSource = {
  url: string;
  title: string;
  domain: string;
  sourceType: string;
  authorityStatus: string;
  sourceStatus: string;
  publishedAt: string | null;
  retrievedAt: string | null;
  relevanceScore: number;
  excerpt: string | null;
};

type DebugHit = {
  chunkId: string;
  provisionNumber: string | null;
  keywordScore: number;
  vectorScore: number;
  rawKeywordScore?: number;
  rawVectorScore?: number;
  boost: number;
  boostBreakdown?: {
    exactReference: number;
    documentMatch: number;
    subjectTerm: number;
    phrase: number;
    titleMatch: number;
    hierarchyMatch: number;
    total: number;
  };
  score: number;
};

type DebugTrace = {
  expandedTerms: string[];
  ranking?: {
    keywordWeight: number;
    vectorWeight: number;
    formula: string;
  };
  keywordResults: DebugHit[];
  vectorResults: DebugHit[];
  mergedResults: DebugHit[];
  evidence: DebugHit[];
};

type ResearchResponse = {
  answer?: string;
  citations?: Citation[];
  research_sources?: ResearchSource[];
  evidenceSufficient?: boolean;
  limitation?: string | null;
  source_mode?: SourceMode;
  metadata?: {
    corpusEvidenceCount?: number;
    webEvidenceCount?: number;
    webDiscoveryCount?: number;
    corpusLimitation?: string | null;
  };
  debug?: DebugTrace;
  error?: { message?: string };
};

function formatHit(hit: DebugHit): string {
  const label = hit.provisionNumber ?? hit.chunkId.slice(0, 8);
  return `${label} (kw=${hit.keywordScore.toFixed(2)}, vec=${hit.vectorScore.toFixed(2)}, boost=${hit.boost.toFixed(2)}, hybrid=${hit.score.toFixed(2)})`;
}

function authorityBadge(
  authority: string | null | undefined,
  t: Messages,
): string {
  if (
    authority === "PRIMARY_OFFICIAL" ||
    authority === "OFFICIAL_GOVERNMENT" ||
    authority === "OFFICIAL_PARLIAMENT"
  ) {
    return t.primaryOfficial;
  }
  if (authority === "OFFICIAL_COURT") {
    return t.court;
  }
  if (authority === "SECONDARY_LEGAL" || authority === "ACADEMIC") {
    return t.secondary;
  }
  return t.webResearch;
}

export function LegalResearchPanel({
  allowDebug = false,
  matterId,
}: {
  allowDebug?: boolean;
  matterId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetQuery = searchParams.get("q") ?? "";
  const shouldAutorun = searchParams.get("autorun") === "1";
  const isDemoResearch = searchParams.get("demo") === "1";
  const autorunStartedRef = useRef(false);

  const [query, setQuery] = useState(presetQuery);
  const [debug, setDebug] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("CORPUS");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);

  const webEnabled = Boolean(matterId);
  const effectiveMode = useMemo<SourceMode>(() => {
    if (!webEnabled && sourceMode !== "CORPUS") {
      return "CORPUS";
    }
    return sourceMode;
  }, [sourceMode, webEnabled]);

  async function runResearch(question: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    setStatus(
      effectiveMode === "CORPUS" ? t.searchingOfficial : t.researching,
    );
    try {
      const response = await fetch("/api/legal/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: trimmed,
          source_mode: effectiveMode,
          ...(matterId ? { matter_id: matterId } : {}),
          debug: allowDebug && debug,
          ...(isDemoResearch
            ? {
                filters: {
                  documentType: "CONSTITUTION" as const,
                  country: "EG",
                },
              }
            : {}),
        }),
      });
      const data = (await response.json()) as ResearchResponse;
      if (!response.ok) {
        throw new Error(data.error?.message ?? t.aiRequestFailed);
      }
      setResult(data);
      const found = data.research_sources?.length ?? data.metadata?.webDiscoveryCount ?? 0;
      if (effectiveMode === "CORPUS") {
        setStatus(null);
      } else {
        setStatus(`${found}`);
      }
    } catch (err) {
      setResult(null);
      setStatus(null);
      setError(err instanceof Error ? err.message : t.aiRequestFailed);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (presetQuery) {
      setQuery(presetQuery);
    }
  }, [presetQuery]);

  useEffect(() => {
    if (!shouldAutorun || !presetQuery || autorunStartedRef.current) return;
    autorunStartedRef.current = true;
    void runResearch(presetQuery);

    // Drop autorun so refresh does not re-fire.
    if (matterId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("autorun");
      const queryString = params.toString();
      router.replace(
        queryString
          ? `/app/matters/${matterId}/research?${queryString}`
          : `/app/matters/${matterId}/research`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autorun once from URL
  }, [shouldAutorun, presetQuery, matterId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await runResearch(query);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-stone-900">
            {t.researchSource}
          </legend>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="radio"
              name="source-mode"
              checked={effectiveMode === "CORPUS"}
              onChange={() => setSourceMode("CORPUS")}
            />
            {t.officialLegalSources}
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${webEnabled ? "text-stone-700" : "text-stone-400"}`}
          >
            <input
              type="radio"
              name="source-mode"
              checked={effectiveMode === "WEB"}
              disabled={!webEnabled}
              onChange={() => setSourceMode("WEB")}
            />
            {t.internet}
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${webEnabled ? "text-stone-700" : "text-stone-400"}`}
          >
            <input
              type="radio"
              name="source-mode"
              checked={effectiveMode === "BOTH"}
              disabled={!webEnabled}
              onChange={() => setSourceMode("BOTH")}
            />
            {t.both}
          </label>
          {!webEnabled ? (
            <p className="text-xs text-stone-500">{t.internetMatterOnly}</p>
          ) : null}
        </fieldset>

        <label className="block text-sm font-medium text-stone-900" htmlFor="legal-question">
          {t.question}
        </label>
        <textarea
          id="legal-question"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder={t.legalQuestionPlaceholder}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
        />
        {allowDebug ? (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={debug}
              onChange={(event) => setDebug(event.target.checked)}
            />
            {t.viewAnalysisDetails}
          </label>
        ) : null}
        <button
          type="submit"
          disabled={pending || !query.trim()}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pending ? t.researching : t.research}
        </button>
      </form>

      {status ? <p className="mt-4 text-sm text-stone-600">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {result?.answer ? (
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-stone-900">{t.answer}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
              {result.answer}
            </p>
          </div>

          {result.citations?.length ? (
            <div>
              <h3 className="text-sm font-medium text-stone-900">Citations</h3>
              <ul className="mt-2 space-y-2">
                {result.citations.map((citation) => (
                  <li
                    key={citation.legalChunkId}
                    className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-stone-900">
                      {citation.marker}. {citation.documentTitle}
                      {citation.citationKind === "LEGAL_CORPUS"
                        ? `, ${citation.provisionLabel}`
                        : ""}
                    </p>
                    <p className="text-stone-600">
                      {citation.citationKind === "WEB"
                        ? `${authorityBadge(citation.webAuthority, t)} · ${citation.sourceName}`
                        : `Official source: ${citation.sourceName}`}
                    </p>
                    {citation.retrievedAt ? (
                      <p className="text-xs text-stone-500">
                        Retrieved {new Date(citation.retrievedAt).toLocaleString()}
                      </p>
                    ) : null}
                    {citation.sourceUrl ? (
                      <a
                        href={citation.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-stone-900 underline"
                      >
                        {citation.sourceUrl}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.research_sources?.length ? (
            <div>
              <h3 className="text-sm font-medium text-stone-900">Sources</h3>
              <p className="mt-1 text-xs text-stone-500">
                Prioritize primary and court sources. Secondary material is supporting only.
              </p>
              <ul className="mt-2 space-y-2">
                {result.research_sources.map((source) => (
                  <li
                    key={`${source.url}-${source.title}`}
                    className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-stone-900">{source.title}</p>
                    <p className="text-stone-600">
                      {authorityBadge(source.authorityStatus, t)} · {source.domain} ·{" "}
                      {source.sourceStatus}
                    </p>
                    {source.publishedAt ? (
                      <p className="text-xs text-stone-500">Published: {source.publishedAt}</p>
                    ) : (
                      <p className="text-xs text-stone-500">Published: unavailable</p>
                    )}
                    {source.retrievedAt ? (
                      <p className="text-xs text-stone-500">
                        Retrieved: {new Date(source.retrievedAt).toLocaleString()}
                      </p>
                    ) : null}
                    {source.excerpt ? (
                      <p className="mt-1 text-stone-700">«{source.excerpt}»</p>
                    ) : (
                      <p className="mt-1 text-xs text-stone-500">
                        Search snippet used for discovery only; not treated as legal evidence.
                      </p>
                    )}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stone-900 underline"
                    >
                      {source.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {allowDebug && result.debug ? (
            <details className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-stone-900">
                Analysis details
              </summary>
              <div className="mt-3 space-y-2 text-stone-700">
                <p>Expanded terms: {result.debug.expandedTerms.join(", ") || "none"}</p>
                {result.debug.ranking ? (
                  <p>
                    Ranking: keyword×{result.debug.ranking.keywordWeight} + vector×
                    {result.debug.ranking.vectorWeight} + boost
                    <span className="block text-xs text-stone-500">
                      {result.debug.ranking.formula}
                    </span>
                  </p>
                ) : null}
                <p>Keyword hits: {result.debug.keywordResults.length}</p>
                <p>Vector hits: {result.debug.vectorResults.length}</p>
                <div>
                  <p className="font-medium text-stone-900">Merged ranking</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {result.debug.mergedResults.slice(0, 8).map((hit) => (
                      <li key={hit.chunkId}>
                        {formatHit(hit)}
                        {hit.boostBreakdown ? (
                          <span className="block text-xs text-stone-500">
                            boosts: exact={hit.boostBreakdown.exactReference}, doc=
                            {hit.boostBreakdown.documentMatch}, subject=
                            {hit.boostBreakdown.subjectTerm}, phrase=
                            {hit.boostBreakdown.phrase}, title=
                            {hit.boostBreakdown.titleMatch}, path=
                            {hit.boostBreakdown.hierarchyMatch}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <p>
                  Evidence sent to the model:{" "}
                  {result.debug.evidence
                    .map((hit) => hit.provisionNumber ?? hit.chunkId.slice(0, 8))
                    .join(", ") || "none"}
                </p>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
