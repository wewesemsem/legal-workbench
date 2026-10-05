import "dotenv/config";
import { desc } from "drizzle-orm";

import { db } from "../src/lib/db";
import { user, verification } from "../src/lib/db/schema";

async function main() {
  const users = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(20);

  const verifications = await db
    .select({
      id: verification.id,
      identifier: verification.identifier,
      expiresAt: verification.expiresAt,
      createdAt: verification.createdAt,
    })
    .from(verification)
    .orderBy(desc(verification.createdAt))
    .limit(20);

  console.log(JSON.stringify({ users, verifications }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
