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
