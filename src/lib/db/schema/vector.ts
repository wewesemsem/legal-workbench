import { customType } from "drizzle-orm/pg-core";

/**
 * pgvector column width for legal embeddings.
 * Migration 0008 creates `vector(1536)`. Changing this requires a new migration.
 * text-embedding-3-small's native width is 1536; the local hash provider uses the same width.
 */
export const LEGAL_VECTOR_DIMENSIONS = 1536;

export const pgVector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions?: number };
}>({
  dataType(config) {
    const dimensions = config?.dimensions ?? LEGAL_VECTOR_DIMENSIONS;
    return `vector(${dimensions})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown) {
    if (Array.isArray(value)) {
      return value.map((item) => Number(item));
    }
    const text = String(value ?? "").trim();
    if (!text || text === "null") {
      return [];
    }
    const body = text.startsWith("[") ? text.slice(1, -1) : text;
    if (!body) {
      return [];
    }
    return body.split(",").map((item) => Number(item.trim()));
  },
});

export const pgTsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});
