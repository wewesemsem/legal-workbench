/**
 * Deterministic legal text normalization.
 * Never uses an LLM. Preserves Arabic legal language.
 */
export function normalizeLegalText(input: string): string {
  // NFC only — does not alter Arabic semantics.
  let text = input.normalize("NFC");

  // Strip common HTML/navigation residue if present.
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(nav|header|footer|aside)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  // Decode a few common HTML entities without changing Arabic letters.
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');

  // Normalize newlines; preserve paragraph boundaries.
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]{2,}/g, " ");

  return text.trim();
}
