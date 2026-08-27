import nodemailer, { Transporter } from "nodemailer";

/**
 * Wraps outbound email (ticket acknowledgments + agent replies — ticket-management
 * Stories 8 and 12). Only place SMTP is touched, per CLAUDE.md's service-layer rule.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    console.warn("[email] SMTP_HOST not set — emails will be logged, not sent");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Shared branded shell for transactional emails (email confirmation now;
 * ticket acknowledgments and agent replies — Stories 8/12 — will reuse this
 * once built, rather than each hand-rolling its own HTML). Light background
 * regardless of the app's own dark-mode-default — most email clients don't
 * reliably support prefers-color-scheme, so a fixed light theme is safest.
 */
export function renderEmailHtml(options: {
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  const { heading, bodyHtml, ctaText, ctaUrl } = options;
  return `
<div style="background-color:#f4f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e5e7;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8f;">AzmSquad Support</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#18181b;">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3f3f46;">${bodyHtml}</div>
    <a href="${ctaUrl}" style="display:inline-block;margin-top:24px;padding:12px 24px;background-color:#c17f1f;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${ctaText}</a>
    <p style="margin:24px 0 0;font-size:12px;color:#9a9a9f;">If the button doesn't work, copy and paste this link:<br><span style="word-break:break-all;">${ctaUrl}</span></p>
  </div>
</div>`.trim();
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dry-run] to=${to} subject="${subject}"\n${text}`);
    return { dryRun: true };
  }

  return t.sendMail({
    from: process.env.SMTP_FROM || "AzmSquad Support <support@example.com>",
    to,
    subject,
    text,
    html,
  });
}
