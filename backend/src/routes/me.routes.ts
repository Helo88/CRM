import express, { Request, Response } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/User";
import { sendEmail, renderEmailHtml } from "../services/email.service";
import { contactBodySchema } from "../validation/me.schema";

const router = express.Router();

const CONFIRM_TOKEN_TTL_MS = 24 * 3600 * 1000;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:4000";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

// GET /api/v1/me/status — self-read of the live role/isActive/permissions,
// so a page that decides what to show (the dashboard's tiles) doesn't have
// to trust the access token's baked-in claims, which go stale the moment an
// admin changes the caller's permissions or deactivates them mid-session
// (the token itself stays validly signed until its own ~15min expiry
// regardless — see services/permissions.ts's isActiveAccount comment for
// the same staleness problem on the API-enforcement side). Self-scoped, so
// no permission key needed — same reasoning as GET /contact below.
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select("role isActive permissions");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(200).json({ role: user.role, isActive: user.isActive, permissions: user.permissions ?? [] });
});

// GET /api/v1/me/contact — self-read, so the settings page (Task 5) has a
// data source for the current phone/email/pendingEmail on load. Neither
// Story 4's endpoint nor decoding the JWT (which only carries { sub, role })
// can supply pendingEmail, so this endpoint is required, not optional.
router.get("/contact", requireAuth, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select("phone email pendingEmail");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(200).json({ phone: user.phone ?? null, email: user.email, pendingEmail: user.pendingEmail });
});

router.patch("/contact", requireAuth, async (req: Request, res: Response) => {
  const rawBody = (req.body ?? {}) as Record<string, unknown>;
  const parsed = contactBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const { phone, email } = parsed.data;

  const user = await User.findById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Phone is optional on the User model (models/User.ts) — an empty string
  // clears it, matching customer.routes.ts's PATCH /customers/:id handling
  // of the same field.
  if ("phone" in rawBody) {
    user.phone = phone;
  }

  if ("email" in rawBody) {
    const normalizedEmail = email as string;
    if (normalizedEmail === user.email) {
      res.status(400).json({ error: "This is already your current email" });
      return;
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.pendingEmail = normalizedEmail;
    user.emailConfirmToken = token;
    user.emailConfirmTokenExpiresAt = new Date(Date.now() + CONFIRM_TOKEN_TTL_MS);

    try {
      const confirmUrl = `${APP_BASE_URL}/api/v1/me/email/confirm?token=${token}`;
      await sendEmail({
        to: normalizedEmail,
        subject: "Confirm your new email address",
        text: `Confirm your new email address for AzmSquad.\n\nOpen this link to complete the change:\n${confirmUrl}\n\nThis link expires in 24 hours. If you didn't request this, you can ignore this email — your email address won't change.`,
        html: renderEmailHtml({
          heading: "Confirm your new email address",
          bodyHtml:
            "You asked to change the email on your AzmSquad account to this address. Confirm it below to finish the change.<br><br>This link expires in 24 hours. If you didn't request this, you can ignore this email — your email address won't change.",
          ctaText: "Confirm email address",
          ctaUrl: confirmUrl,
        }),
      });
    } catch (err) {
      user.pendingEmail = null;
      user.emailConfirmToken = null;
      user.emailConfirmTokenExpiresAt = null;
      await user.save();
      res.status(502).json({ error: "Could not send confirmation email" });
      return;
    }
  }

  // Single save for both fields — avoids two round-trips when both
  // phone and email are present in the same request.
  await user.save();
  res.status(200).json({ phone: user.phone ?? null, email: user.email, pendingEmail: user.pendingEmail });
});

// This is a link a human clicks from their email client, not an API call a
// script makes — it must land somewhere a browser can render, not JSON.
// Redirects to a public frontend page (frontend/app/email-confirmed/page.tsx)
// rather than /settings directly: whoever clicks it may not be authenticated
// in that browser at all (e.g. opening the email on a different device), so
// a page requiring a session isn't a safe landing target.
router.get("/email/confirm", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const user = await User.findOne({ emailConfirmToken: token });

  if (!user || !user.emailConfirmTokenExpiresAt || user.emailConfirmTokenExpiresAt < new Date()) {
    res.redirect(`${CLIENT_ORIGIN}/email-confirmed?status=invalid`);
    return;
  }

  const existing = await User.findOne({ email: user.pendingEmail });
  if (existing) {
    user.pendingEmail = null;
    user.emailConfirmToken = null;
    user.emailConfirmTokenExpiresAt = null;
    await user.save();
    res.redirect(`${CLIENT_ORIGIN}/email-confirmed?status=conflict`);
    return;
  }

  user.email = user.pendingEmail as string;
  user.pendingEmail = null;
  user.emailConfirmToken = null;
  user.emailConfirmTokenExpiresAt = null;

  try {
    await user.save();
  } catch (err) {
    // Race: someone else confirmed the same address in the TOCTOU window
    // between the findOne check above and this save() — email's unique
    // index throws E11000 rather than letting a silent duplicate through.
    if ((err as { code?: number }).code === 11000) {
      res.redirect(`${CLIENT_ORIGIN}/email-confirmed?status=conflict`);
      return;
    }
    throw err;
  }

  res.redirect(`${CLIENT_ORIGIN}/email-confirmed?status=success&email=${encodeURIComponent(user.email)}`);
});

export default router;
