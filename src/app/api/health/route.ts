import { sql } from "drizzle-orm";

import { jsonOk } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  let database: "ok" | "error" = "ok";
  let databaseError: string | undefined;

  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    database = "error";
    databaseError = error instanceof Error ? error.message : "unknown";
  }

  const status = database === "ok" ? "ok" : "degraded";

  return jsonOk({
    status,
    service: "lawyer-workbench",
    database,
    ...(databaseError ? { databaseError } : {}),
  });
}
