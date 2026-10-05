import { getEnv } from "@/lib/env";

type VerificationEmailInput = {
  firstName: string;
  verifyUrl: string;
};

type WelcomeEmailInput = {
  firstName: string;
};

function layout(title: string, bodyHtml: string, bodyText: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f1ea;color:#1c1917;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border:1px solid #e7e5e4;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#78716c;">
                  Lawyer Workbench
                </p>
                <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#1c1917;">
                  ${title}
                </h1>
                <div style="margin-top:20px;font-size:16px;line-height:1.6;color:#44403c;">
                  ${bodyHtml}
                </div>
                <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#78716c;">
                  Middle East Legal Workbench — starting with Egypt.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Lawyer Workbench\n\n${title}\n\n${bodyText}\n\nMiddle East Legal Workbench — starting with Egypt.\n`;

  return { html, text };
}

export function buildVerificationEmail(input: VerificationEmailInput) {
  const env = getEnv();
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hello ${escapeHtml(input.firstName)},</p>
    <p style="margin:0 0 16px;">
      Thank you for creating your Lawyer Workbench account. Please confirm your
      email address to finish setup and keep your workspace secure.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(input.verifyUrl)}"
         style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;">
        Confirm email address
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#78716c;">
      This link expires soon and can be used once. If you did not create an account,
      you can ignore this message.
    </p>
    <p style="margin:0;font-size:13px;word-break:break-all;color:#a8a29e;">
      ${escapeHtml(input.verifyUrl)}
    </p>
  `;

  const bodyText = [
    `Hello ${input.firstName},`,
    "",
    "Thank you for creating your Lawyer Workbench account. Confirm your email address to finish setup:",
    input.verifyUrl,
    "",
    "This link expires soon and can be used once. If you did not create an account, ignore this message.",
    "",
    `App: ${env.NEXT_PUBLIC_APP_URL}`,
  ].join("\n");

  const { html, text } = layout("Confirm your email", bodyHtml, bodyText);
  return {
    subject: "Confirm your Lawyer Workbench email",
    html,
    text,
  };
}

export function buildWelcomeEmail(input: WelcomeEmailInput) {
  const env = getEnv();
  const bodyHtml = `
    <p style="margin:0 0 16px;">Welcome, ${escapeHtml(input.firstName)}.</p>
    <p style="margin:0 0 16px;">
      Your email is verified and your Lawyer Workbench account is ready. You can
      sign in and begin building your secure legal workspace.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(`${env.NEXT_PUBLIC_APP_URL}/login`)}"
         style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;">
        Sign in to Lawyer Workbench
      </a>
    </p>
    <p style="margin:0;font-size:14px;color:#78716c;">
      Coming next: workspaces, matters, documents, and grounded legal research.
    </p>
  `;

  const bodyText = [
    `Welcome, ${input.firstName}.`,
    "",
    "Your email is verified and your Lawyer Workbench account is ready.",
    `Sign in: ${env.NEXT_PUBLIC_APP_URL}/login`,
    "",
    "Coming next: workspaces, matters, documents, and grounded legal research.",
  ].join("\n");

  const { html, text } = layout("Welcome to Lawyer Workbench", bodyHtml, bodyText);
  return {
    subject: "Welcome to Lawyer Workbench",
    html,
    text,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
