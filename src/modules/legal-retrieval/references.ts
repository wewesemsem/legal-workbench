import {
  foldArabic,
  ordinalFromHeading,
  westernDigits,
} from "@/modules/legal-corpus/hierarchy";

export type DetectedLawReference = {
  number: string;
  year: string;
};

export type DetectedLegalReferences = {
  articleNumbers: string[];
  laws: DetectedLawReference[];
  mentionsConstitution: boolean;
  phrases: string[];
  /** True when the query asked for one or more explicit article numbers. */
  hasExplicitArticleReference: boolean;
};

const ENGLISH_ORDINALS: Record<string, string> = {
  first: "1",
  one: "1",
  second: "2",
  two: "2",
  third: "3",
  three: "3",
  fourth: "4",
  four: "4",
  fifth: "5",
  five: "5",
  sixth: "6",
  six: "6",
  seventh: "7",
  seven: "7",
  eighth: "8",
  eight: "8",
  ninth: "9",
  nine: "9",
  tenth: "10",
  ten: "10",
};

const MAX_ARTICLE_RANGE = 40;

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseArticleToken(token: string): string | null {
  const digit = westernDigits(token.trim());
  if (/^[0-9]+$/.test(digit)) {
    return digit;
  }
  const ordinal = ordinalFromHeading(token);
  if (ordinal) {
    return ordinal;
  }
  const mapped = ENGLISH_ORDINALS[foldArabic(token).toLowerCase()];
  return mapped ?? null;
}

/** Inclusive numeric range, capped for safety. */
export function expandArticleRange(start: string, end: string): string[] {
  const from = Number(westernDigits(start));
  const to = Number(westernDigits(end));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < 1) {
    return [];
  }
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  if (high - low + 1 > MAX_ARTICLE_RANGE) {
    return [];
  }
  const numbers: string[] = [];
  for (let value = low; value <= high; value += 1) {
    numbers.push(String(value));
  }
  return numbers;
}

function detectArticleRanges(query: string): string[] {
  const numbers: string[] = [];
  const patterns = [
    /\barticles?\s+([0-9٠-٩۰-۹]+)\s*(?:–|—|-|to|through|thru)\s*([0-9٠-٩۰-۹]+)/gi,
    /المواد\s+(?:من\s+)?([0-9٠-٩۰-۹]+)\s*(?:إلى|الى|إلي|–|—|-)\s*([0-9٠-٩۰-۹]+)/gi,
    /المواد\s+([0-9٠-٩۰-۹]+)\s*(?:إلى|الى|إلي|–|—|-)\s*([0-9٠-٩۰-۹]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of query.matchAll(pattern)) {
      numbers.push(...expandArticleRange(match[1] ?? "", match[2] ?? ""));
    }
  }
  return numbers;
}

function detectOrdinalArticleNumbers(query: string): string[] {
  const numbers: string[] = [];
  const english = query.matchAll(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|one|two|three|four|five|six|seven|eight|nine|ten)\s+articles?\b/gi,
  );
  for (const match of english) {
    const mapped = ENGLISH_ORDINALS[(match[1] ?? "").toLowerCase()];
    if (mapped) numbers.push(mapped);
  }
  const englishArticleFirst = query.matchAll(
    /\barticles?\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
  );
  for (const match of englishArticleFirst) {
    const mapped = ENGLISH_ORDINALS[(match[1] ?? "").toLowerCase()];
    if (mapped) numbers.push(mapped);
  }

  const folded = foldArabic(query);
  for (const match of folded.matchAll(/الماد[ةه]\s+(?:رقم\s+)?([^\s،.]+)/g)) {
    const token = match[1] ?? "";
    // Skip range connectors already handled elsewhere.
    if (token === "من" || token === "الي" || token === "إلى") {
      continue;
    }
    const parsed = parseArticleToken(token);
    if (parsed) numbers.push(parsed);
  }
  for (const match of folded.matchAll(/ماد[ةه]\s*\(\s*([^\s)]+)\s*\)/g)) {
    const parsed = parseArticleToken(match[1] ?? "");
    if (parsed) numbers.push(parsed);
  }
  return numbers;
}

export function detectLegalReferences(query: string): DetectedLegalReferences {
  const articleNumbers: string[] = [];
  const laws: DetectedLawReference[] = [];
  const phrases: string[] = [];

  articleNumbers.push(...detectArticleRanges(query));

  const articlePatterns = [
    /\barticles?\s+([0-9٠-٩۰-۹]+)/gi,
    /\bart\.?\s*([0-9٠-٩۰-۹]+)\b/gi,
    /المادة\s+(?:رقم\s*)?([0-9٠-٩۰-۹]+)/gi,
    /مادة\s*\(\s*([0-9٠-٩۰-۹]+)\s*\)/gi,
  ];
  for (const pattern of articlePatterns) {
    for (const match of query.matchAll(pattern)) {
      articleNumbers.push(westernDigits(match[1] ?? ""));
    }
  }
  articleNumbers.push(...detectOrdinalArticleNumbers(query));

  const lawPatterns = [
    /\blaw\s*(?:no\.?|number)?\s*([0-9٠-٩۰-۹]+)\s*(?:of|\/)\s*([0-9٠-٩۰-۹]{4})/gi,
    /قانون\s*(?:رقم\s*)?([0-9٠-٩۰-۹]+)\s*(?:لسنة|لعام|\/)\s*([0-9٠-٩۰-۹]{4})/gi,
  ];
  for (const pattern of lawPatterns) {
    for (const match of query.matchAll(pattern)) {
      laws.push({
        number: westernDigits(match[1] ?? ""),
        year: westernDigits(match[2] ?? ""),
      });
    }
  }

  for (const match of query.matchAll(/"([^"]{3,160})"/g)) {
    phrases.push(match[1]!.trim());
  }
  for (const match of query.matchAll(/«([^»]{3,160})»/g)) {
    phrases.push(match[1]!.trim());
  }

  const lawKeys = new Set<string>();
  const uniqueLaws = laws.filter((law) => {
    const key = `${law.number}:${law.year}`;
    if (lawKeys.has(key)) {
      return false;
    }
    lawKeys.add(key);
    return true;
  });

  const uniqueArticles = unique(articleNumbers);

  return {
    articleNumbers: uniqueArticles,
    laws: uniqueLaws,
    mentionsConstitution:
      /\bconstitutions?\b/i.test(query) ||
      /constitutional/i.test(query) ||
      query.includes("الدستور") ||
      query.includes("دستور"),
    phrases: unique(phrases),
    hasExplicitArticleReference: uniqueArticles.length > 0,
  };
}

export function missingInstrumentMessage(
  law: DetectedLawReference,
  articleNumber?: string,
): string {
  const subject = articleNumber ? `Article ${articleNumber}` : "that provision";
  return `I don't currently have Law No. ${law.number} of ${law.year} in the indexed legal corpus, so I can't verify ${subject} from the available primary sources.`;
}
