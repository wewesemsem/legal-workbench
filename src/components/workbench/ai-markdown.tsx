"use client";

import type { ReactNode } from "react";

function looksArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.9em] text-stone-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key++}
            href={linkMatch[2]}
            className="underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
            target="_blank"
            rel="noreferrer"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function AiMarkdown({ content }: { content: string }) {
  const rtl = looksArabic(content);
  const blocks = content.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <div
      className="space-y-3 text-sm leading-6 text-stone-800"
      dir={rtl ? "rtl" : undefined}
      lang={rtl ? "ar" : undefined}
    >
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => /^[-*]\s+/.test(line.trim()));
        if (isList) {
          return (
            <ul key={index} className="list-disc space-y-1 ps-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(line.replace(/^[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
          const text = lines[0].replace(/^#{1,3}\s+/, "");
          return (
            <p key={index} className="font-medium text-stone-900">
              {renderInline(text)}
            </p>
          );
        }

        if (block.startsWith("```")) {
          const code = block.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "");
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-md bg-stone-100 px-3 py-2 font-mono text-xs text-stone-800"
            >
              {code}
            </pre>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export { looksArabic };
