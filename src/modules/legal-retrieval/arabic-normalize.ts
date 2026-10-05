/**
 * Search-only Arabic normalization.
 * Never apply this to authoritative source_text stored in the corpus.
 */
export function normalizeArabicForSearch(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\u0640/g, "") // tatweel ـ
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    // Harakat / Quranic marks only — do not use a range that swallows Arabic digits.
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Expand lexical tokens so FTS can match both surface and normalized forms.
 */
export function lexicalSearchVariants(token: string): string[] {
  const trimmed = token.trim();
  if (!trimmed) {
    return [];
  }
  const normalized = normalizeArabicForSearch(trimmed);
  if (!normalized || normalized === trimmed) {
    return [trimmed];
  }
  return [trimmed, normalized];
}

export function buildNormalizedSearchText(retrievalText: string): string {
  return normalizeArabicForSearch(retrievalText);
}
