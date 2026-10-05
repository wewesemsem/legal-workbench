import { describe, expect, it } from "vitest";

import {
  formatAllowedToolHints,
  normalizeToolDecisionInput,
  parseToolDecision,
} from "@/modules/agents/model-gateway";

describe("agent tool decision normalization", () => {
  it("documents required input.query for search tools", () => {
    const hints = formatAllowedToolHints([
      "search_legal_corpus",
      "search_web",
      "list_matter_documents",
    ]);
    expect(hints).toContain('search_legal_corpus: input { "query": string');
    expect(hints).toContain('search_web: input { "query": string }');
    expect(hints).toContain("list_matter_documents: input {}");
  });

  it("defaults missing query to the task for search tools", () => {
    const task = "what is the first sentence of the egyptian constitution";
    expect(
      normalizeToolDecisionInput("search_web", {}, task),
    ).toEqual({ query: task });
    expect(
      normalizeToolDecisionInput(
        "search_legal_corpus",
        { limit: 5 },
        task,
      ),
    ).toEqual({ limit: 5, query: task });
    expect(
      normalizeToolDecisionInput(
        "search_legal_corpus",
        { query: "  Article 1  " },
        task,
      ),
    ).toEqual({ query: "  Article 1  " });
  });

  it("preserves explicit article references from the task over rewritten corpus queries", () => {
    const task = "What is Article 1 of the Egyptian Constitution?";
    expect(
      normalizeToolDecisionInput(
        "search_legal_corpus",
        { query: "identity of the Egyptian state constitution" },
        task,
      ),
    ).toEqual({ query: task });
    expect(
      normalizeToolDecisionInput(
        "retrieve_legal_provision",
        { query: "Egyptian constitutional principles" },
        task,
      ),
    ).toEqual({ query: task });
    expect(
      normalizeToolDecisionInput(
        "search_web",
        { query: "identity of the Egyptian state constitution" },
        task,
      ),
    ).toEqual({ query: "identity of the Egyptian state constitution" });
  });

  it("accepts top-level query when input object is empty", () => {
    const decision = parseToolDecision(
      {
        type: "tool",
        tool: "search_legal_corpus",
        query: "Egyptian Constitution Article 1",
        input: {},
      },
      ["search_legal_corpus"],
      "fallback task",
    );
    expect(decision).toEqual({
      type: "tool",
      tool: "search_legal_corpus",
      input: { query: "Egyptian Constitution Article 1" },
      reason: undefined,
    });
  });

  it("fills query from task when model omits input entirely", () => {
    const task = "what is the first sentence of the egyptian constitution";
    const decision = parseToolDecision(
      {
        type: "tool",
        tool: "search_web",
      },
      ["search_web", "search_legal_corpus"],
      task,
    );
    expect(decision).toEqual({
      type: "tool",
      tool: "search_web",
      input: { query: task },
      reason: undefined,
    });
  });
});
