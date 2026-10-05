/**
 * Derive an isolated `*_test` database URL so vitest never mutates the
 * developer/live corpus database pointed at by `.env`.
 */
export function toTestDatabaseUrl(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const currentName = decodeURIComponent(
    parsed.pathname.replace(/^\//, "") || "lawyer_workbench",
  );
  if (currentName.endsWith("_test")) {
    return databaseUrl;
  }
  parsed.pathname = `/${encodeURIComponent(`${currentName}_test`)}`;
  return parsed.toString();
}

export function databaseNameFromUrl(databaseUrl: string): string {
  try {
    return decodeURIComponent(
      new URL(databaseUrl).pathname.replace(/^\//, ""),
    );
  } catch {
    return "";
  }
}
