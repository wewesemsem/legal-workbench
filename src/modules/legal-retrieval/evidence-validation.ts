import {
  evidenceDocumentCanonicalId,
  evidenceJurisdictionCode,
  normalizeArticleNumber,
  normalizeJurisdictionCode,
  targetDocumentCanonicalId,
} from "@/modules/legal-retrieval/legal-identity";
import type { ResearchTarget } from "@/modules/legal-retrieval/research-target";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";

export type EvidenceMatchDiagnostics = {
  document_match: boolean;
  jurisdiction_match: boolean;
  article_match: boolean;
  provision_match: boolean;
  rejection_reason: string | null;
  wanted: {
    document_id: string | null;
    jurisdiction: string | null;
    article_numbers: string[];
    document_label: string | null;
    document_type: string | null;
  };
  actual: {
    document_id: string | null;
    jurisdiction: string | null;
    country: string | null;
    raw_jurisdiction: string | null;
    article_number: string | null;
    provision_number: string | null;
    title: string;
    document_type: string | null;
    source_kind: string;
  };
};

export type EvidenceValidationDecision = {
  evidence: LegalEvidence;
  accepted: boolean;
  reason: string;
  diagnostics: EvidenceMatchDiagnostics;
};

export type EvidenceValidationResult = {
  accepted: LegalEvidence[];
  rejected: LegalEvidence[];
  decisions: EvidenceValidationDecision[];
  /** True when the target required a specific provision that was not found. */
  missingTargetProvision: boolean;
};

function targetArticleNumbers(target: ResearchTarget): string[] {
  return [
    ...new Set(
      target.targetArticles
        .map((item) => normalizeArticleNumber(item))
        .filter((item): item is string => item != null),
    ),
  ];
}

function evidenceArticleNumber(evidence: LegalEvidence): string | null {
  return normalizeArticleNumber(evidence.provisionNumber);
}

function jurisdictionMatchesTarget(
  evidence: LegalEvidence,
  target: ResearchTarget,
): boolean {
  const wanted = normalizeJurisdictionCode(target.jurisdiction);
  if (!wanted) return true;
  const actual = evidenceJurisdictionCode(evidence);
  if (!actual) return true;
  return actual === wanted;
}

function documentMatchesTarget(
  evidence: LegalEvidence,
  target: ResearchTarget,
): boolean {
  if (!target.document && !target.documentType) return true;

  if (
    target.documentType &&
    evidence.documentType &&
    evidence.documentType !== target.documentType
  ) {
    return false;
  }

  if (!target.document) return true;

  const wantedId = targetDocumentCanonicalId(target);
  const actualId = evidenceDocumentCanonicalId(evidence);
  if (wantedId && actualId) {
    return wantedId === actualId;
  }

  const haystack = `${evidence.title} ${evidence.heading ?? ""}`.toLowerCase();
  const needle = target.document.toLowerCase();

  if (needle.includes("egyptian") || needle.includes("egypt")) {
    const jurisdiction = evidenceJurisdictionCode(evidence);
    if (jurisdiction && jurisdiction !== "EG") return false;
    if (target.documentType === "CONSTITUTION") {
      return (
        evidence.documentType === "CONSTITUTION" ||
        haystack.includes("دستور") ||
        haystack.includes("constitution")
      );
    }
  }

  if (needle.includes("constitution")) {
    return (
      evidence.documentType === "CONSTITUTION" ||
      haystack.includes("دستور") ||
      haystack.includes("constitution")
    );
  }

  // Loose title containment when a specific document label is set.
  const significant = needle
    .replace(/\b(the|of|and)\b/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);
  if (!significant.length) return true;
  return significant.some((token) => haystack.includes(token));
}

function articleMatchesTarget(
  evidence: LegalEvidence,
  target: ResearchTarget,
): boolean {
  const wanted = targetArticleNumbers(target);
  if (!wanted.length) return true;
  if (evidence.sourceKind !== "LEGAL_CORPUS") {
    // Strict article targeting: do not let web/matter distractors answer.
    return false;
  }
  const number = evidenceArticleNumber(evidence);
  if (!number) return false;
  return wanted.includes(number);
}

function buildDiagnostics(
  evidence: LegalEvidence,
  target: ResearchTarget,
  checks: {
    jurisdiction_match: boolean;
    document_match: boolean;
    article_match: boolean;
  },
): EvidenceMatchDiagnostics {
  const wantedArticles = targetArticleNumbers(target);
  const actualArticle = evidenceArticleNumber(evidence);
  const provision_match =
    checks.jurisdiction_match &&
    checks.document_match &&
    checks.article_match;

  let rejection_reason: string | null = null;
  if (!checks.jurisdiction_match) {
    const wantedCode =
      normalizeJurisdictionCode(target.jurisdiction) ?? target.jurisdiction;
    const actualCode =
      evidenceJurisdictionCode(evidence) ??
      evidence.jurisdiction ??
      evidence.country;
    rejection_reason = `Jurisdiction mismatch (wanted ${wantedCode}, got ${actualCode}; raw_jurisdiction=${evidence.jurisdiction || "none"}, country=${evidence.country || "none"})`;
  } else if (!checks.document_match) {
    rejection_reason = `Document mismatch (wanted ${targetDocumentCanonicalId(target) ?? target.document ?? target.documentType}, got ${evidenceDocumentCanonicalId(evidence) ?? evidence.title})`;
  } else if (!checks.article_match) {
    rejection_reason = wantedArticles.length
      ? `Article mismatch (wanted ${wantedArticles.join(", ")}, got ${actualArticle ?? evidence.provisionNumber ?? "none"})`
      : "Provision does not match research target";
  }

  return {
    document_match: checks.document_match,
    jurisdiction_match: checks.jurisdiction_match,
    article_match: checks.article_match,
    provision_match,
    rejection_reason,
    wanted: {
      document_id: targetDocumentCanonicalId(target),
      jurisdiction: normalizeJurisdictionCode(target.jurisdiction),
      article_numbers: wantedArticles,
      document_label: target.document,
      document_type: target.documentType ?? null,
    },
    actual: {
      document_id: evidenceDocumentCanonicalId(evidence),
      jurisdiction: evidenceJurisdictionCode(evidence),
      country: evidence.country || null,
      raw_jurisdiction: evidence.jurisdiction || null,
      article_number: actualArticle,
      provision_number: evidence.provisionNumber,
      title: evidence.title,
      document_type: evidence.documentType || null,
      source_kind: evidence.sourceKind,
    },
  };
}

/**
 * Deterministic relevance check: only evidence that matches the resolved
 * research target may reach answer generation.
 */
export function validateEvidenceAgainstTarget(
  evidence: LegalEvidence[],
  target: ResearchTarget,
): EvidenceValidationResult {
  const decisions: EvidenceValidationDecision[] = [];
  const wantedArticles = targetArticleNumbers(target);

  for (const item of evidence) {
    const jurisdiction_match = jurisdictionMatchesTarget(item, target);
    const document_match = documentMatchesTarget(item, target);
    const article_match = articleMatchesTarget(item, target);
    const diagnostics = buildDiagnostics(item, target, {
      jurisdiction_match,
      document_match,
      article_match,
    });

    if (!jurisdiction_match || !document_match || !article_match) {
      decisions.push({
        evidence: item,
        accepted: false,
        reason: diagnostics.rejection_reason ?? "Does not match research target",
        diagnostics,
      });
      continue;
    }

    decisions.push({
      evidence: item,
      accepted: true,
      reason: wantedArticles.length
        ? `Article ${evidenceArticleNumber(item)} matches research target`
        : "Matches research target",
      diagnostics,
    });
  }

  const accepted = decisions
    .filter((item) => item.accepted)
    .map((item) => item.evidence);
  const rejected = decisions
    .filter((item) => !item.accepted)
    .map((item) => item.evidence);

  const missingTargetProvision =
    wantedArticles.length > 0 &&
    !accepted.some((item) => {
      const number = evidenceArticleNumber(item);
      return (
        item.sourceKind === "LEGAL_CORPUS" &&
        number != null &&
        wantedArticles.includes(number)
      );
    });

  return {
    accepted,
    rejected,
    decisions,
    missingTargetProvision,
  };
}
