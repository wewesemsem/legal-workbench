import { askLegalQuestion } from "@/modules/legal-retrieval/answer";
import { searchLegalCorpus } from "@/modules/legal-retrieval/service";
import { classifyWebDomain } from "@/modules/legal-retrieval/web/classify";

export type RetrievalEvalCase = {
  id: string;
  query: string;
  expect: {
    evidenceSufficient: boolean;
    topProvisionNumbers?: string[];
    mustIncludeProvisionNumbers?: string[];
    limitationIncludes?: string;
  };
};

export const PHASE9_CONSTITUTION_EVAL: RetrievalEvalCase[] = [
  {
    id: "article-25",
    query: "What does Article 25 of the Egyptian Constitution say?",
    expect: {
      evidenceSufficient: true,
      topProvisionNumbers: ["25"],
      mustIncludeProvisionNumbers: ["25"],
    },
  },
  {
    id: "education",
    query: "What does the Egyptian Constitution say about education?",
    expect: {
      evidenceSufficient: true,
      mustIncludeProvisionNumbers: ["19"],
    },
  },
  {
    id: "equality",
    query: "Find the constitutional provision concerning equality.",
    expect: {
      evidenceSufficient: true,
      topProvisionNumbers: ["53"],
      mustIncludeProvisionNumbers: ["53"],
    },
  },
  {
    id: "missing-law",
    query: "What does Article 25 of Law 12 of 2003 say?",
    expect: {
      evidenceSufficient: false,
      limitationIncludes: "Law No. 12 of 2003",
    },
  },
  {
    id: "human-rights-arabic",
    query: "ماذا يقول الدستور عن المساواة؟",
    expect: {
      evidenceSufficient: true,
      mustIncludeProvisionNumbers: ["53"],
    },
  },
  {
    id: "mixed-language-education",
    query: "What does الدستور say about التعليم؟",
    expect: {
      evidenceSufficient: true,
      mustIncludeProvisionNumbers: ["19"],
    },
  },
];

export const PHASE10_WEB_CLASSIFICATION_EVAL = [
  {
    id: "parliament-official",
    domain: "parliament.gov.eg",
    expectAuthority: "OFFICIAL_PARLIAMENT",
  },
  {
    id: "government-official",
    domain: "egypt.gov.eg",
    expectAuthority: "OFFICIAL_GOVERNMENT",
  },
  {
    id: "secondary-legal",
    domain: "legalcommentary.example",
    expectAuthority: "SECONDARY_LEGAL",
  },
  {
    id: "general-web",
    domain: "random-blog.example",
    expectAuthority: "GENERAL_WEB",
  },
] as const;

export function runPhase10ClassificationEval(
  cases = PHASE10_WEB_CLASSIFICATION_EVAL,
) {
  const results = cases.map((testCase) => {
    const classified = classifyWebDomain(testCase.domain);
    const passed = classified.authority === testCase.expectAuthority;
    return {
      id: testCase.id,
      passed,
      failures: passed
        ? []
        : [`expected ${testCase.expectAuthority}, got ${classified.authority}`],
      authority: classified.authority,
    };
  });
  return {
    passed: results.every((result) => result.passed),
    results,
  };
}

export async function runLegalRetrievalEval(cases = PHASE9_CONSTITUTION_EVAL) {
  const results = [];
  for (const testCase of cases) {
    const search = await searchLegalCorpus({ query: testCase.query, debug: true });
    const answer = await askLegalQuestion({ query: testCase.query, debug: true });
    const ranked = search.debug?.mergedResults.map((hit) => hit.provisionNumber) ?? [];
    const evidenceNums = search.evidence.map((item) => item.provisionNumber);

    const failures: string[] = [];
    if (search.evidenceSufficient !== testCase.expect.evidenceSufficient) {
      failures.push(
        `evidenceSufficient expected ${testCase.expect.evidenceSufficient}, got ${search.evidenceSufficient}`,
      );
    }
    if (testCase.expect.topProvisionNumbers?.length) {
      const top = ranked[0] ?? evidenceNums[0] ?? null;
      if (top !== testCase.expect.topProvisionNumbers[0]) {
        failures.push(
          `top provision expected ${testCase.expect.topProvisionNumbers[0]}, got ${top}`,
        );
      }
    }
    for (const number of testCase.expect.mustIncludeProvisionNumbers ?? []) {
      if (!evidenceNums.includes(number)) {
        failures.push(`evidence missing Article ${number}`);
      }
    }
    if (
      testCase.expect.limitationIncludes &&
      !answer.limitation?.includes(testCase.expect.limitationIncludes)
    ) {
      failures.push(`limitation missing "${testCase.expect.limitationIncludes}"`);
    }

    results.push({
      id: testCase.id,
      passed: failures.length === 0,
      failures,
      rankedTop: ranked.slice(0, 5),
      evidence: evidenceNums,
      citations: answer.citations.map((citation) => citation.provisionLabel),
      evidenceSufficient: search.evidenceSufficient,
      answerPreview: answer.answer.slice(0, 240),
      scoreBreakdown: search.debug?.mergedResults.slice(0, 5).map((hit) => ({
        provisionNumber: hit.provisionNumber,
        rawKeywordScore: hit.rawKeywordScore,
        rawVectorScore: hit.rawVectorScore,
        keywordScore: hit.keywordScore,
        vectorScore: hit.vectorScore,
        boost: hit.boost,
        boostBreakdown: hit.boostBreakdown,
        hybridScore: hit.score,
      })),
    });
  }

  return {
    passed: results.every((result) => result.passed),
    results,
  };
}
