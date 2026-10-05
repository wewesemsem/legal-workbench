export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProviderName = "console" | "resend";

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(message: EmailMessage): Promise<void>;
}
