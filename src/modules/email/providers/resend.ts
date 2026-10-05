import { getEnv } from "@/lib/env";
import type { EmailProvider } from "@/modules/email/types";

export function createResendEmailProvider(): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      const env = getEnv();
      if (!env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(
          `Resend email failed (${response.status})${details ? `: ${details}` : ""}`,
        );
      }
    },
  };
}
