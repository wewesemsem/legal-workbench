import "dotenv/config";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { resetEnvCacheForTests } from "@/lib/env";

import { toTestDatabaseUrl } from "./database-url";

const env = process.env as Record<string, string | undefined>;

if (!env.NODE_ENV) {
  env.NODE_ENV = "test";
}
env.NEXT_PUBLIC_APP_URL = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
env.BETTER_AUTH_URL = env.BETTER_AUTH_URL || "http://localhost:3000";

if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
  env.BETTER_AUTH_SECRET = "test-secret-lawyer-workbench-32chars-min";
}

const DEFAULT_DEV_DATABASE_URL =
  "postgresql://lawyer:lawyer@localhost:55432/lawyer_workbench";

// Prefer explicit TEST_DATABASE_URL; otherwise force a sibling `*_test` DB.
// Always override dotenv's DATABASE_URL in the test process.
env.DATABASE_URL =
  env.TEST_DATABASE_URL?.trim() ||
  toTestDatabaseUrl(env.DATABASE_URL?.trim() || DEFAULT_DEV_DATABASE_URL);

// Mock providers are tests-only. Force them here so a real .env cannot break CI/local tests.
env.WEB_SEARCH_PROVIDER = "mock";
env.LLM_PROVIDER = "mock";
env.LEGAL_EMBEDDING_PROVIDER = "mock";
env.DOCUMENT_AI_PROVIDER = "mock";
// Keep verification flows covered even when local/staging turn the gate off.
env.REQUIRE_EMAIL_VERIFICATION = "true";

// Drop any prior cached client from a previous vitest run in this process.
const globalForDb = globalThis as { pgClient?: unknown };
delete globalForDb.pgClient;

resetEnvCacheForTests();

async function ensureTestDatabaseReady(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const dbName = decodeURIComponent(
    parsed.pathname.replace(/^\//, "") || "lawyer_workbench_test",
  );
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run vitest against non-test database "${dbName}". Set TEST_DATABASE_URL to a *_test database.`,
    );
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const existing = await admin<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM pg_database WHERE datname = ${dbName}
      ) AS exists
    `;
    if (!existing[0]?.exists) {
      // CREATE DATABASE cannot run in a parameterized query.
      await admin.unsafe(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.info(`[vitest] created isolated database ${dbName}`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }

  const migrator = postgres(databaseUrl, { max: 1 });
  try {
    await migrate(drizzle(migrator), {
      migrationsFolder: path.join(process.cwd(), "drizzle/migrations"),
    });
  } finally {
    await migrator.end({ timeout: 5 });
  }
}

await ensureTestDatabaseReady(env.DATABASE_URL);
resetEnvCacheForTests();
