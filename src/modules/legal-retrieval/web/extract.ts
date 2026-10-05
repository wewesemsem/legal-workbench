import { JSDOM } from "jsdom";

import { sha256Hex } from "@/modules/legal-corpus/checksum";

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".advertisement",
  ".ads",
  ".cookie",
  "#cookie",
];

function collapseWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractWebPageContent(input: {
  html: string;
  url: string;
}): {
  title: string;
  content: string;
  language: string;
  checksum: string;
} {
  const dom = new JSDOM(input.html, { url: input.url });
  const { document } = dom.window;

  for (const selector of REMOVE_SELECTORS) {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  }

  const title =
    document.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() ||
    document.querySelector("title")?.textContent?.trim() ||
    "";

  const language =
    document.documentElement.getAttribute("lang")?.trim() ||
    document.querySelector("meta[http-equiv='content-language']")?.getAttribute("content")?.trim() ||
    "und";

  const root =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.body;

  const blocks: string[] = [];
  const nodes = root?.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th,blockquote,pre") ?? [];
  for (const node of nodes) {
    const text = collapseWhitespace(node.textContent ?? "");
    if (text.length >= 2) {
      blocks.push(text);
    }
  }

  let content = collapseWhitespace(blocks.join("\n\n"));
  if (content.length < 40) {
    content = collapseWhitespace(root?.textContent ?? "");
  }

  // Cap extracted content for LLM evidence use.
  if (content.length > 40_000) {
    content = `${content.slice(0, 40_000).trim()}…`;
  }

  return {
    title,
    content,
    language: language.slice(0, 16),
    checksum: sha256Hex(content),
  };
}
