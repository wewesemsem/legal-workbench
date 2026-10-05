import "dotenv/config";

import { resendEmailVerification } from "../src/modules/auth/email-verification";
import { findConsoleEmail } from "../src/modules/email/providers/console";

async function main() {
  const email = process.argv[2];
  if (!email) {
    throw new Error("Usage: tsx scripts/print-verification-link.ts <email>");
  }

  await resendEmailVerification(
    email,
    new Request("http://localhost/api/auth/resend-verification", {
      method: "POST",
      headers: { "x-forwarded-for": "127.0.0.1" },
    }),
  );

  const message = findConsoleEmail(email, "Confirm your Lawyer Workbench");
  const link = message?.text.match(/https?:\/\/\S+/)?.[0];

  if (!link) {
    throw new Error("No verification link found. Is the account unverified?");
  }

  console.log(link);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
