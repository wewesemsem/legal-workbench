import type { EmailMessage, EmailProvider } from "@/modules/email/types";

const sentEmails: EmailMessage[] = [];

export const consoleEmailProvider: EmailProvider = {
  name: "console",
  async send(message) {
    sentEmails.push(message);
    const linkMatch = message.text.match(/https?:\/\/\S+/);
    console.info("\n========== DEV EMAIL (not sent externally) ==========");
    console.info(`To: ${message.to}`);
    console.info(`Subject: ${message.subject}`);
    if (linkMatch?.[0]) {
      console.info(`Link: ${linkMatch[0]}`);
    }
    console.info("=====================================================\n");
  },
};

export function getConsoleSentEmails() {
  return [...sentEmails];
}

export function clearConsoleSentEmails() {
  sentEmails.length = 0;
}

export function findConsoleEmail(to: string, subjectIncludes?: string) {
  return [...sentEmails]
    .reverse()
    .find(
      (email) =>
        email.to.toLowerCase() === to.toLowerCase() &&
        (!subjectIncludes || email.subject.includes(subjectIncludes)),
    );
}
