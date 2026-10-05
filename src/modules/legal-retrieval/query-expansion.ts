/**
 * Query-only Arabic equivalents for common English legal questions.
 * This does not rewrite stored source text.
 */
const CONCEPTS: Record<string, string[]> = {
  education: ["التعليم", "التربية"],
  educational: ["التعليم"],
  school: ["التعليم"],
  university: ["الجامعات", "التعليم"],
  teacher: ["المعلمين", "التعليم"],
  equality: ["المساواة", "متساوون", "سواء"],
  equal: ["المساواة", "متساوون"],
  discrimination: ["تمييز"],
  freedom: ["الحرية", "الحريات"],
  liberty: ["الحرية"],
  work: ["العمل"],
  labor: ["العمل"],
  labour: ["العمل"],
  employment: ["العمل"],
  constitution: ["الدستور"],
  constitutional: ["الدستور"],
  citizen: ["المواطن", "المواطنين"],
  citizens: ["المواطنين"],
  literacy: ["الأمية"],
  illiteracy: ["الأمية"],
  rights: ["الحقوق"],
  court: ["المحكمة", "القضاء"],
  justice: ["العدل", "العدالة"],
  religion: ["الدين"],
  language: ["اللغة"],
  health: ["الصحة"],
  housing: ["السكن"],
  property: ["الملكية"],
  election: ["الانتخابات"],
  elections: ["الانتخابات"],
  parliament: ["النواب", "البرلمان"],
  president: ["رئيس الجمهورية"],
};

export type ExpandedQuery = {
  lexicalText: string;
  embedText: string;
  addedTerms: string[];
};

export function expandLegalQuery(query: string): ExpandedQuery {
  const added = new Set<string>();
  const tokens = query.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  for (const token of tokens) {
    for (const term of CONCEPTS[token] ?? []) {
      added.add(term);
    }
  }
  const addedTerms = [...added];
  const suffix = addedTerms.length ? `\n${addedTerms.join(" ")}` : "";
  return {
    lexicalText: `${query}${suffix}`.trim(),
    embedText: `${query}${suffix}`.trim(),
    addedTerms,
  };
}
