import { createHash } from "node:crypto";

export function sha256Hex(input: Buffer | string): string {
  const hash = createHash("sha256");
  hash.update(input);
  return hash.digest("hex");
}

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    // Normalize trailing slash for paths that are not root.
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
