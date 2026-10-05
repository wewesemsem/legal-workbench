import { getEnv } from "@/lib/env";
import { consoleEmailProvider } from "@/modules/email/providers/console";
import { createResendEmailProvider } from "@/modules/email/providers/resend";
import {
  buildVerificationEmail,
  buildWelcomeEmail,
} from "@/modules/email/templates";
import type { EmailProvider } from "@/modules/email/types";

let providerOverride: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (providerOverride) {
    return providerOverride;
  }

  const env = getEnv();
  if (env.EMAIL_PROVIDER === "resend") {
    return createResendEmailProvider();
  }

  return consoleEmailProvider;
}

export function setEmailProviderForTests(provider: EmailProvider | null) {
  providerOverride = provider;
}

export async function sendEmailVerificationMessage(input: {
  to: string;
  firstName: string;
  verifyUrl: string;
}) {
  const template = buildVerificationEmail({
    firstName: input.firstName,
    verifyUrl: input.verifyUrl,
  });

  await getEmailProvider().send({
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendWelcomeMessage(input: {
  to: string;
  firstName: string;
}) {
  const template = buildWelcomeEmail({ firstName: input.firstName });

  await getEmailProvider().send({
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
