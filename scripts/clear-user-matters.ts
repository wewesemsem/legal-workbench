import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import {
  documents,
  documentPages,
  matterMembers,
  matters,
  user,
} from "../src/lib/db/schema";

const email = (process.argv[2] ?? "").toLowerCase();
const confirm = process.argv.includes("--confirm");

if (!email) {
  console.error("Usage: npx tsx scripts/clear-user-matters.ts <email> [--confirm]");
  process.exit(1);
}

async function main() {
  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  const existing = users[0];
  if (!existing) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const rows = await db
    .select({
      id: matters.id,
      title: matters.title,
      status: matters.status,
      createdBy: matters.createdBy,
      role: matterMembers.role,
      memberCount: sql<number>`(
        select count(*)::int from matter_members mm2 where mm2.matter_id = ${matters.id}
      )`,
    })
    .from(matters)
    .innerJoin(matterMembers, eq(matterMembers.matterId, matters.id))
    .where(eq(matterMembers.userId, existing.id));

  const matterIds = [...new Set(rows.map((row) => row.id))];

  let storageKeys: string[] = [];
  if (matterIds.length) {
    const docs = await db
      .select({
        storageLocation: documents.storageLocation,
        id: documents.id,
      })
      .from(documents)
      .where(inArray(documents.matterId, matterIds));

    const docIds = docs.map((d) => d.id);
    const pages =
      docIds.length === 0
        ? []
        : await db
            .select({ storageLocation: documentPages.storageLocation })
            .from(documentPages)
            .where(inArray(documentPages.documentId, docIds));

    storageKeys = [
      ...docs.map((d) => d.storageLocation).filter(Boolean),
      ...pages.map((p) => p.storageLocation).filter(Boolean),
    ] as string[];
  }

  console.log(
    JSON.stringify(
      {
        userId: existing.id,
        email: existing.email,
        matterCount: matterIds.length,
        matters: rows,
        storageKeyCount: storageKeys.length,
      },
      null,
      2,
    ),
  );

  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm to delete these matters.");
    return;
  }

  if (matterIds.length === 0) {
    console.log("No matters to delete.");
    return;
  }

  await db.delete(matters).where(inArray(matters.id, matterIds));
  console.log(`Deleted ${matterIds.length} matter(s).`);

  if (storageKeys.length) {
    const { unlink } = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.env.LOCAL_STORAGE_PATH ?? ".data/storage";
    let removed = 0;
    for (const key of storageKeys) {
      const filePath = path.isAbsolute(key) ? key : path.join(root, key);
      try {
        await unlink(filePath);
        removed += 1;
      } catch {
        // ignore missing files
      }
    }
    console.log(`Removed ${removed}/${storageKeys.length} storage object(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
