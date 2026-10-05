import type {
  LegalProvisionType,
  ParsedProvision,
} from "@/modules/legal-corpus/types";

const TYPE_SLUG: Record<LegalProvisionType, string> = {
  DOCUMENT: "document",
  BOOK: "book",
  PART: "part",
  TITLE: "title",
  CHAPTER: "chapter",
  SECTION: "section",
  ARTICLE: "article",
  PARAGRAPH: "paragraph",
  CLAUSE: "clause",
  OTHER: "other",
};

/** Longest folded ordinals first so "الثاني عشر" wins over "الثاني". */
const ORDINALS: Array<[string, string]> = [
  ["الحادي عشر", "11"],
  ["الثاني عشر", "12"],
  ["الثالث عشر", "13"],
  ["الرابع عشر", "14"],
  ["الخامس عشر", "15"],
  ["السادس عشر", "16"],
  ["السابع عشر", "17"],
  ["الثامن عشر", "18"],
  ["التاسع عشر", "19"],
  ["العشرون", "20"],
  ["العاشر", "10"],
  ["التاسع", "9"],
  ["الثامن", "8"],
  ["السابع", "7"],
  ["السادس", "6"],
  ["الخامس", "5"],
  ["الرابع", "4"],
  ["الثالث", "3"],
  ["الثاني", "2"],
  ["الاول", "1"],
];

export function foldArabic(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ً-ٰ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function westernDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function ordinalFromHeading(heading: string | null | undefined): string | null {
  if (!heading?.trim()) {
    return null;
  }
  const folded = foldArabic(heading);
  const digit = folded.match(/[0-9]+/);
  if (digit?.[0]) {
    return digit[0];
  }
  for (const [word, number] of ORDINALS) {
    if (folded.includes(word)) {
      return number;
    }
  }
  return null;
}

export function hierarchySegment(input: {
  provisionType: LegalProvisionType;
  provisionNumber?: string | null;
  heading?: string | null;
  siblingIndex: number;
}): string {
  const slug = TYPE_SLUG[input.provisionType];
  const fromNumber = input.provisionNumber?.trim()
    ? westernDigits(input.provisionNumber.trim())
    : "";
  const tokenSource =
    fromNumber || ordinalFromHeading(input.heading) || String(input.siblingIndex);
  const token = tokenSource
    .toLowerCase()
    .replace(/مكرر/g, " bis ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${slug}_${token || input.siblingIndex}`;
}

export function documentHierarchyRoot(documentType: string): string {
  switch (documentType) {
    case "CONSTITUTION":
      return "constitution";
    case "LEGISLATION":
      return "legislation";
    case "REGULATION":
      return "regulation";
    default:
      return documentType.toLowerCase();
  }
}

export type HierarchyNode = {
  provision: ParsedProvision;
  hierarchyPath: string;
  parentHierarchyPath: string | null;
};

export function collectProvisions(provisions: ParsedProvision[]): ParsedProvision[] {
  const collected: ParsedProvision[] = [];
  function walk(nodes: ParsedProvision[]) {
    for (const node of nodes) {
      collected.push(node);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  }
  walk(provisions);
  return collected;
}

function hasNestedStructure(provisions: ParsedProvision[]): boolean {
  for (const node of provisions) {
    for (const child of node.children ?? []) {
      if (
        child.provisionType === "ARTICLE" ||
        child.provisionType === "PART" ||
        child.provisionType === "CHAPTER" ||
        child.provisionType === "SECTION" ||
        child.provisionType === "BOOK" ||
        child.provisionType === "TITLE"
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Attach flat part/chapter/section/article siblings when the parser did not nest them.
 * Existing paragraph/clause children stay on their article.
 */
export function nestLegalProvisions(provisions: ParsedProvision[]): ParsedProvision[] {
  if (hasNestedStructure(provisions)) {
    return provisions;
  }

  const roots: ParsedProvision[] = [];
  let part: ParsedProvision | null = null;
  let chapter: ParsedProvision | null = null;
  let section: ParsedProvision | null = null;

  const place = (parent: ParsedProvision | null, node: ParsedProvision) => {
    if (parent) {
      parent.children = parent.children ?? [];
      parent.children.push(node);
      return;
    }
    roots.push(node);
  };

  for (const node of provisions) {
    const copy: ParsedProvision = {
      ...node,
      children: [...(node.children ?? [])],
    };
    if (copy.provisionType === "PART" || copy.provisionType === "BOOK") {
      part = copy;
      chapter = null;
      section = null;
      roots.push(copy);
      continue;
    }
    if (copy.provisionType === "TITLE" || copy.provisionType === "CHAPTER") {
      chapter = copy;
      section = null;
      place(part, copy);
      continue;
    }
    if (copy.provisionType === "SECTION") {
      section = copy;
      place(chapter ?? part, copy);
      continue;
    }
    if (copy.provisionType === "ARTICLE") {
      place(section ?? chapter ?? part, copy);
      continue;
    }
    roots.push(copy);
  }

  return roots;
}

export function assignHierarchyPaths(
  documentType: string,
  provisions: ParsedProvision[],
): HierarchyNode[] {
  const nested = nestLegalProvisions(provisions);
  const root = documentHierarchyRoot(documentType);
  const nodes: HierarchyNode[] = [];

  function walk(items: ParsedProvision[], parent: HierarchyNode | null) {
    const counts = new Map<string, number>();
    const prefix = parent?.hierarchyPath ?? root;
    for (const item of items) {
      const seen = (counts.get(item.provisionType) ?? 0) + 1;
      counts.set(item.provisionType, seen);
      const segment = hierarchySegment({
        provisionType: item.provisionType,
        provisionNumber: item.provisionNumber,
        heading: item.heading,
        siblingIndex: seen,
      });
      const node: HierarchyNode = {
        provision: item,
        hierarchyPath: `${prefix}.${segment}`,
        parentHierarchyPath: parent?.hierarchyPath ?? null,
      };
      nodes.push(node);
      if (item.children?.length) {
        walk(item.children, node);
      }
    }
  }

  walk(nested, null);
  return nodes;
}

export function ancestorsOf(nodes: HierarchyNode[], node: HierarchyNode): HierarchyNode[] {
  const byPath = new Map(nodes.map((item) => [item.hierarchyPath, item]));
  const chain: HierarchyNode[] = [];
  let parentPath = node.parentHierarchyPath;
  while (parentPath) {
    const parent = byPath.get(parentPath);
    if (!parent) {
      break;
    }
    chain.push(parent);
    parentPath = parent.parentHierarchyPath;
  }
  return chain.reverse();
}

export type StoredProvisionLinkInput = {
  id: string;
  parentId: string | null;
  provisionType: LegalProvisionType;
  provisionNumber: string | null;
  heading: string | null;
  sequence: number;
};

export type StoredProvisionLink = {
  parentId: string | null;
  hierarchyPath: string;
  title: string | null;
};

/**
 * Rebuild parent links from the stored sequence of a flat import.
 * Paragraph and clause rows keep the parent they were stored with.
 * Source text is not read or rewritten.
 */
export function linkStoredProvisions(
  documentType: string,
  rows: StoredProvisionLinkInput[],
): Map<string, StoredProvisionLink> {
  const structural = rows
    .filter(
      (row) => row.provisionType !== "PARAGRAPH" && row.provisionType !== "CLAUSE",
    )
    .sort((left, right) => left.sequence - right.sequence);

  const parentById = new Map<string, string | null>();
  let partId: string | null = null;
  let chapterId: string | null = null;
  let sectionId: string | null = null;

  for (const row of structural) {
    if (row.provisionType === "PART" || row.provisionType === "BOOK") {
      parentById.set(row.id, null);
      partId = row.id;
      chapterId = null;
      sectionId = null;
      continue;
    }
    if (row.provisionType === "TITLE" || row.provisionType === "CHAPTER") {
      parentById.set(row.id, partId);
      chapterId = row.id;
      sectionId = null;
      continue;
    }
    if (row.provisionType === "SECTION") {
      parentById.set(row.id, chapterId ?? partId);
      sectionId = row.id;
      continue;
    }
    if (row.provisionType === "ARTICLE") {
      parentById.set(row.id, sectionId ?? chapterId ?? partId);
      continue;
    }
    parentById.set(row.id, null);
  }

  for (const row of rows) {
    if (row.provisionType === "PARAGRAPH" || row.provisionType === "CLAUSE") {
      parentById.set(row.id, row.parentId);
    }
  }

  const byParent = new Map<string | null, StoredProvisionLinkInput[]>();
  for (const row of rows) {
    const parentId = parentById.get(row.id) ?? null;
    const list = byParent.get(parentId) ?? [];
    list.push(row);
    byParent.set(parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((left, right) => left.sequence - right.sequence);
  }

  const result = new Map<string, StoredProvisionLink>();
  const root = documentHierarchyRoot(documentType);

  function walk(parentId: string | null, parentPath: string) {
    const children = byParent.get(parentId) ?? [];
    const counts = new Map<string, number>();
    for (const child of children) {
      const seen = (counts.get(child.provisionType) ?? 0) + 1;
      counts.set(child.provisionType, seen);
      const segment = hierarchySegment({
        provisionType: child.provisionType,
        provisionNumber: child.provisionNumber,
        heading: child.heading,
        siblingIndex: seen,
      });
      const hierarchyPath = `${parentPath}.${segment}`;
      result.set(child.id, {
        parentId,
        hierarchyPath,
        title: child.heading,
      });
      walk(child.id, hierarchyPath);
    }
  }

  walk(null, root);
  return result;
}
