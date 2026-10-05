import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

function createClient() {
  const { DATABASE_URL } = getEnv();
  return postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = globalForDb.pgClient ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
