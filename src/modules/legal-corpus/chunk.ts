import {
  ancestorsOf,
  assignHierarchyPaths,
  type HierarchyNode,
} from "@/modules/legal-corpus/hierarchy";
import type {
  LegalProvisionType,
  ParsedProvision,
} from "@/modules/legal-corpus/types";

export const DEFAULT_ARTICLE_CHUNK_CHARS = 4_000;

export type LegalChunkDraft = {
  hierarchyPath: string;
  provisionType: LegalProvisionType;
  provisionNumber?: string;
  articleNumber?: string;
  paragraphNumber?: string;
  heading?: string;
  /** Authoritative source text for this chunk. */
  text: string;
  sourceText: string;
  pageNumber?: number;
  sequence: number;
  textOrigin: ParsedProvision["textOrigin"];
  ancestors: Array<{
    provisionType: LegalProvisionType;
    heading?: string;
    provisionNumber?: string;
  }>;
  metadata?: Record<string, unknown>;
};

function draftFromNode(
  node: HierarchyNode,
  nodes: HierarchyNode[],
  sequence: number,
  sourceText: string,
  articleNumber?: string,
): LegalChunkDraft {
  const ancestors = ancestorsOf(nodes, node).map((ancestor) => ({
    provisionType: ancestor.provision.provisionType,
    heading: ancestor.provision.heading,
    provisionNumber: ancestor.provision.provisionNumber,
  }));
  return {
    hierarchyPath: node.hierarchyPath,
    provisionType: node.provision.provisionType,
    provisionNumber: node.provision.provisionNumber,
    articleNumber:
      node.provision.provisionType === "ARTICLE"
        ? node.provision.provisionNumber
        : articleNumber,
    paragraphNumber:
      node.provision.provisionType === "PARAGRAPH" ||
      node.provision.provisionType === "CLAUSE"
        ? node.provision.provisionNumber
        : undefined,
    heading: node.provision.heading,
    text: sourceText,
    sourceText,
    pageNumber: node.provision.pageNumber,
    sequence,
    textOrigin: node.provision.textOrigin,
    ancestors,
    metadata: node.provision.metadata,
  };
}

/**
 * Retrieval units follow legal structure.
 * An article stays one chunk unless it exceeds the size limit and has
 * multiple paragraph or clause children in the source.
 */
export function chunkProvisions(
  provisions: ParsedProvision[],
  options?: { documentType?: string; maxArticleChars?: number },
): LegalChunkDraft[] {
  const nodes = assignHierarchyPaths(options?.documentType ?? "DOCUMENT", provisions);
  const maxChars = options?.maxArticleChars ?? DEFAULT_ARTICLE_CHUNK_CHARS;
  const chunks: LegalChunkDraft[] = [];
  let sequence = 1;

  for (const node of nodes) {
    const type = node.provision.provisionType;
    if (type !== "ARTICLE" && type !== "OTHER") {
      continue;
    }

    const children = nodes.filter(
      (candidate) =>
        candidate.parentHierarchyPath === node.hierarchyPath &&
        (candidate.provision.provisionType === "PARAGRAPH" ||
          candidate.provision.provisionType === "CLAUSE"),
    );
    const split = node.provision.text.length > maxChars && children.length > 1;
    if (!split) {
      chunks.push(draftFromNode(node, nodes, sequence++, node.provision.text));
      continue;
    }

    for (const child of children) {
      chunks.push(
        draftFromNode(
          child,
          nodes,
          sequence++,
          child.provision.text,
          node.provision.provisionNumber,
        ),
      );
    }
  }

  return chunks;
}
