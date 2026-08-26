import express, { Request, Response } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/User";
import { sendEmail } from "../services/email.service";

const router = express.Router();

const CONFIRM_TOKEN_TTL_MS = 24 * 3600 * 1000;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:4000";

interface ContactBody {
  phone?: unknown;
  email?: unknown;
}

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

router.patch("/contact", requireAuth, async (req: Request<unknown, unknown, ContactBody>, res: Response) => {
  const { phone, email } = req.body;
  const user = await User.findById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (phone !== undefined) {
    if (typeof phone !== "string") {
      res.status(400).json({ error: "phone must be a string" });
      return;
    }
    // Phone is optional on the User model (models/User.ts) — an empty
    // string clears it, matching customer.routes.ts's PATCH /customers/:id
    // handling of the same field.
    user.phone = phone.trim().length === 0 ? undefined : phone.trim();
  }

  if (email !== undefined) {
    if (typeof email !== "string") {
      res.status(400).json({ error: "valid email is required" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      // Validate AFTER trim/lowercase — a copy-pasted address with
      // surrounding whitespace should be cleaned up, not rejected.
      res.status(400).json({ error: "valid email is required" });
      return;
    }
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
      await sendEmail({
        to: normalizedEmail,
        subject: "Confirm your new email",
        text: `Confirm your new email: ${APP_BASE_URL}/api/v1/me/email/confirm?token=${token}`,
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

router.get("/email/confirm", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const user = await User.findOne({ emailConfirmToken: token });

  if (!user || !user.emailConfirmTokenExpiresAt || user.emailConfirmTokenExpiresAt < new Date()) {
    res.status(410).json({ error: "Confirmation link is invalid or has expired" });
    return;
  }

  const existing = await User.findOne({ email: user.pendingEmail });
  if (existing) {
    user.pendingEmail = null;
    user.emailConfirmToken = null;
    user.emailConfirmTokenExpiresAt = null;
    await user.save();
    res.status(409).json({ error: "That email was just confirmed by another account" });
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
      res.status(409).json({ error: "That email was just confirmed by another account" });
      return;
    }
    throw err;
  }

  res.status(200).json({ message: "Email confirmed", email: user.email });
});

export default router;
