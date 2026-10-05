import { describe, expect, it } from "vitest";

import { resolveConversationContext } from "@/modules/legal-retrieval/conversation-context";
import { validateEvidenceAgainstTarget } from "@/modules/legal-retrieval/evidence-validation";
import type { LegalEvidence } from "@/modules/legal-retrieval/types";
import { synthesizeFromEvidence } from "@/modules/legal-retrieval/synthesize";

function corpusArticle(input: {
  number: string;
  text: string;
  title?: string;
  /** ISO country code stored on corpus rows (typically EG). */
  country?: string;
  /**
   * Corpus administrative label. Production constitution rows use NATIONAL,
   * not the country code — tests must exercise that shape.
   */
  jurisdiction?: string;
}): LegalEvidence {
  return {
    sourceKind: "LEGAL_CORPUS",
    chunkId: `chunk-${input.number}`,
    documentId: "doc-const",
    provisionId: `prov-${input.number}`,
    title: input.title ?? "دستور جمهورية مصر العربية",
    heading: `مادة (${input.number})`,
    provisionType: "ARTICLE",
    provisionNumber: input.number,
    text: input.text,
    score: 1,
    sourceUrl: null,
    authorityStatus: "AUTHORITATIVE_SOURCE",
    language: "ar",
    hierarchyPath: `constitution.article_${input.number}`,
    documentType: "CONSTITUTION",
    country: input.country ?? "EG",
    jurisdiction: input.jurisdiction ?? "NATIONAL",
    issuingAuthority: "Egypt",
    date: null,
  };
}

describe("conversation research context", () => {
  it("resolves Egyptian constitution correction to Article 1 / first sentence", () => {
    const first = resolveConversationContext({
      message: "whats the first sentence of the constitution",
    });
    expect(first.target.documentType).toBe("CONSTITUTION");
    expect(first.target.targetArticles).toContain("1");
    expect(first.target.answerMode).toBe("exact_text");

    const corrected = resolveConversationContext({
      message: "no im talking about the egyptian constitution",
      history: [
        { role: "user", content: "whats the first sentence of the constitution" },
        {
          role: "assistant",
          content: "According to the US Constitution…",
        },
      ],
    });

    expect(corrected.relation).toBe("correction");
    expect(corrected.target.jurisdiction).toBe("Egypt");
    expect(corrected.target.document).toMatch(/Egyptian Constitution/i);
    expect(corrected.target.targetArticles).toContain("1");
    expect(corrected.target.answerMode).toBe("exact_text");
    expect(corrected.target.resolvedRequest.toLowerCase()).toMatch(
      /egyptian constitution/,
    );
    expect(corrected.target.resolvedRequest.toLowerCase()).toMatch(
      /first sentence|article 1/,
    );
  });

  it("keeps Article 1 as the target for direct Article 1 questions", () => {
    const resolved = resolveConversationContext({
      message: "What does Article 1 say?",
      history: [
        {
          role: "user",
          content: "Research the Egyptian Constitution privacy provisions",
        },
        { role: "assistant", content: "Article 68 protects…" },
      ],
    });

    // Explicit article follow-up/new article reference should target 1, not 68.
    expect(resolved.target.targetArticles).toEqual(["1"]);
    expect(resolved.target.answerMode).toBe("exact_text");
  });

  it("resolves Article 2 follow-up against the same Egyptian Constitution", () => {
    const resolved = resolveConversationContext({
      message: "What about Article 2?",
      history: [
        {
          role: "user",
          content: "What does Article 1 of the Egyptian Constitution say?",
        },
        {
          role: "assistant",
          content: "Article 1 says the Arab Republic of Egypt…",
        },
      ],
    });

    expect(resolved.relation).toBe("follow_up");
    expect(resolved.target.document).toMatch(/Egyptian Constitution/i);
    expect(resolved.target.jurisdiction).toBe("Egypt");
    expect(resolved.target.targetArticles).toEqual(["2"]);
    expect(resolved.target.resolvedRequest).toMatch(/Article 2/i);
    expect(resolved.target.resolvedRequest).toMatch(/Egyptian Constitution/i);
  });

  it("switches the active article to 68 when asked next", () => {
    const resolved = resolveConversationContext({
      message: "What does Article 68 say?",
      history: [
        {
          role: "user",
          content: "What does Article 1 of the Egyptian Constitution say?",
        },
        {
          role: "assistant",
          content: "Article 1 text…",
        },
      ],
    });

    expect(resolved.target.document).toMatch(/Egyptian Constitution/i);
    expect(resolved.target.targetArticles).toEqual(["68"]);
  });

  it("updates active document on jurisdiction/document correction", () => {
    const resolved = resolveConversationContext({
      message: "Actually, I'm asking about the Egyptian constitution.",
      history: [
        {
          role: "user",
          content: "What is the first sentence of the US Constitution?",
        },
        {
          role: "assistant",
          content: "We the People…",
        },
      ],
    });

    expect(["correction", "clarification"]).toContain(resolved.relation);
    expect(resolved.target.jurisdiction).toBe("Egypt");
    expect(resolved.target.document).toMatch(/Egyptian Constitution/i);
    expect(resolved.target.targetArticles).toContain("1");
    expect(resolved.target.answerMode).toBe("exact_text");
  });
});

describe("evidence validation against research target", () => {
  const article1Text =
    "جمهورية مصر العربية دولة ذات سيادة، موحدة لا تقبل التجزئة.";

  it("Test A: accepts Egyptian Constitution + Article 1 against matching evidence", () => {
    const target = resolveConversationContext({
      message: "What does Article 1 of the Egyptian Constitution say?",
    }).target;

    const validation = validateEvidenceAgainstTarget(
      [
        corpusArticle({
          number: "1",
          text: article1Text,
          title: "Egyptian Constitution",
        }),
      ],
      target,
    );

    expect(validation.accepted.map((item) => item.provisionNumber)).toEqual([
      "1",
    ]);
    expect(validation.missingTargetProvision).toBe(false);
    expect(validation.decisions[0]?.diagnostics.jurisdiction_match).toBe(true);
    expect(validation.decisions[0]?.diagnostics.document_match).toBe(true);
    expect(validation.decisions[0]?.diagnostics.article_match).toBe(true);
    expect(validation.decisions[0]?.diagnostics.provision_match).toBe(true);
  });

  it("Test B: rejects Egyptian Constitution + Article 68 when target is Article 1", () => {
    const target = resolveConversationContext({
      message: "What does Article 1 of the Egyptian Constitution say?",
    }).target;

    const article1 = corpusArticle({
      number: "1",
      text: article1Text,
    });
    const article68 = corpusArticle({
      number: "68",
      text: "المعلومات والبيانات والحرية الرقمية…",
    });
    article68.score = 99;

    const validation = validateEvidenceAgainstTarget(
      [article68, article1],
      target,
    );

    expect(validation.accepted.map((item) => item.provisionNumber)).toEqual([
      "1",
    ]);
    expect(validation.rejected.map((item) => item.provisionNumber)).toEqual([
      "68",
    ]);
    expect(
      validation.decisions.find((item) => item.evidence.provisionNumber === "68")
        ?.diagnostics.article_match,
    ).toBe(false);
    expect(validation.missingTargetProvision).toBe(false);
  });

  it("Test C: accepts Arabic document title equivalent to Egyptian Constitution", () => {
    const target = resolveConversationContext({
      message: "What does Article 1 of the Egyptian Constitution say?",
    }).target;

    const validation = validateEvidenceAgainstTarget(
      [
        corpusArticle({
          number: "1",
          text: article1Text,
          title: "دستور جمهورية مصر العربية",
        }),
      ],
      target,
    );

    expect(validation.accepted).toHaveLength(1);
    expect(validation.decisions[0]?.diagnostics.document_match).toBe(true);
    expect(validation.decisions[0]?.diagnostics.wanted.document_id).toBe(
      "egypt_constitution",
    );
    expect(validation.decisions[0]?.diagnostics.actual.document_id).toBe(
      "egypt_constitution",
    );
  });

  it("Test D: accepts string article number '1' and production NATIONAL jurisdiction", () => {
    const target = resolveConversationContext({
      message: "What does Article 1 of the Egyptian Constitution say?",
    }).target;

    const evidence = corpusArticle({
      number: "1",
      text: article1Text,
      title: "Egyptian Constitution",
      country: "EG",
      jurisdiction: "NATIONAL",
    });

    const validation = validateEvidenceAgainstTarget([evidence], target);

    expect(validation.accepted).toHaveLength(1);
    expect(validation.decisions[0]?.diagnostics.jurisdiction_match).toBe(true);
    expect(validation.decisions[0]?.diagnostics.actual.jurisdiction).toBe("EG");
    expect(validation.decisions[0]?.diagnostics.actual.raw_jurisdiction).toBe(
      "NATIONAL",
    );
    expect(validation.decisions[0]?.reason).toMatch(
      /Article 1 matches research target/i,
    );
  });

  it("Test E: rejects Article 1 when the research target is Article 2", () => {
    const target = resolveConversationContext({
      message: "What does Article 2 of the Egyptian Constitution say?",
    }).target;

    const validation = validateEvidenceAgainstTarget(
      [
        corpusArticle({
          number: "1",
          text: article1Text,
        }),
      ],
      target,
    );

    expect(validation.accepted).toEqual([]);
    expect(validation.missingTargetProvision).toBe(true);
    expect(validation.decisions[0]?.diagnostics.article_match).toBe(false);
  });

  it("Test F: first-sentence constitution request validates and answers from Article 1", () => {
    const target = resolveConversationContext({
      message: "What is the first sentence of the constitution?",
    }).target;

    expect(target.document).toMatch(/Egyptian Constitution/i);
    expect(target.jurisdiction).toBe("Egypt");
    expect(target.targetArticles).toContain("1");
    expect(target.answerMode).toBe("exact_text");

    const evidence = corpusArticle({
      number: "1",
      text: `${article1Text} نص إضافي بعد الجملة الأولى.`,
      title: "دستور جمهورية مصر العربية",
      country: "EG",
      jurisdiction: "NATIONAL",
    });

    const validation = validateEvidenceAgainstTarget([evidence], target);
    expect(validation.accepted).toHaveLength(1);
    expect(validation.missingTargetProvision).toBe(false);
    expect(validation.decisions[0]?.diagnostics.provision_match).toBe(true);
    expect(validation.decisions[0]?.reason).toMatch(
      /Article 1 matches research target/i,
    );

    const synthesized = synthesizeFromEvidence({
      query: target.resolvedRequest,
      evidence: validation.accepted,
      answerMode: "exact_text",
    });
    expect(synthesized.answer).toContain("جمهورية مصر العربية دولة ذات سيادة");
    expect(synthesized.answer).not.toContain("نص إضافي");
    expect(synthesized.answer.toLowerCase()).toMatch(/first sentence/);
  });

  it("marks missing target provision when only distractors are retrieved", () => {
    const target = resolveConversationContext({
      message: "Quote Article 1 of the Egyptian Constitution",
    }).target;

    const validation = validateEvidenceAgainstTarget(
      [
        corpusArticle({
          number: "68",
          text: "digital rights privacy text",
        }),
      ],
      target,
    );

    expect(validation.accepted).toEqual([]);
    expect(validation.missingTargetProvision).toBe(true);
  });
});
