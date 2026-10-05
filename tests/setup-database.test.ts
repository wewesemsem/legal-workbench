import { describe, expect, it } from "vitest";

import { toTestDatabaseUrl } from "./database-url";
import { assertTestDatabase, clearLegalCorpusTablesForTests } from "./helpers";

describe("vitest database isolation", () => {
  it("forces a *_test database URL", () => {
    expect(
      toTestDatabaseUrl(
        "postgresql://lawyer:lawyer@localhost:55432/lawyer_workbench",
      ),
    ).toContain("/lawyer_workbench_test");
    expect(process.env.DATABASE_URL ?? "").toMatch(/_test(?:\?|$)/);
    expect(() => assertTestDatabase()).not.toThrow();
  });

  it("allows corpus cleanup only because DATABASE_URL is isolated", async () => {
    await expect(clearLegalCorpusTablesForTests()).resolves.toBeUndefined();
  });
});
