import express, { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth";
import { User, IUser } from "../models/User";
import { isValidPhone } from "../utils/phone";

// security-admin Story 46: agent/admin access to the roster and creation
// endpoints below is UNCHANGED from before this story — only the
// newly-added subadmin role is actually gated on a permission, so a
// delegated sub-admin gets exactly customers:manage, nothing more. This is
// not `requireRole("agent","admin","subadmin"), requirePermission(...)`
// composed as two chained middlewares, because that would also gate agent
// (whose default permission set does not include customers:manage) —
// see .squad/plans/security-admin/09-story-configure-roles-and-permissions.md
// Task 4 for why that naive conversion is a regression.
function staffOrDelegatedSubadmin(key: Parameters<typeof requirePermission>[0]) {
  return (req: Request, res: Response, next: import("express").NextFunction) => {
    if (req.user!.role === "subadmin") {
      requirePermission(key)(req, res, next);
      return;
    }
    next();
  };
}

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// Fields safely editable via this endpoint (Story 4).
// role / isActive / passwordHash / internalNotes / attachments are intentionally
// excluded — see USER_STORIES.md customer-management Story 4 and Story 7.
const EDITABLE_FIELDS = ["name", "email", "phone", "preferredLanguage"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

function toProfileResponse(user: IUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isActive: user.isActive,
    // See customer-management Story 6 (view-customer-interaction-history). URL shape only.
    ticketHistoryUrl: `/api/v1/customers/${user.id}/history`,
  };
}

// Not part of any story in USER_STORIES.md — Story 4's own plan explicitly
// flagged this as a gap ("no list/search endpoint... do not invent one
// speculatively") and deferred it. Added at the user's direct request.
// Staff-only: this is a customer roster, not the agent/admin account list
// that Story 45 (security-admin) will own separately.
router.get(
  "/",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = { role: "customer" as const };

  const [customers, total] = await Promise.all([
    User.find(filter)
      .select("name email phone isActive createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone ?? null,
      isActive: c.isActive,
      createdAt: c.createdAt,
    })),
    total,
    page,
    limit,
  });
});

interface CreateCustomerBody {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

// USER_STORIES.md customer-management Story 55 ("Add a customer account (as
// staff)") — staff-created customer, initial password set directly (no
// invite-email flow yet). Mirrors auth.routes.ts's /register validation, but
// role is always "customer" here too — staff cannot use this to create an
// agent/admin account (that's Story 45, security-admin, a separate endpoint).
router.post(
  "/",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  async (req: Request<unknown, unknown, CreateCustomerBody>, res: Response) => {
    const { name, email, password, phone } = req.body ?? {};

    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email, and password are required" });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    if (phone !== undefined && phone.trim() !== "" && !isValidPhone(phone.trim())) {
      res.status(400).json({ error: "phone must be a valid phone number" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    let user;
    try {
      user = await User.create({
        name,
        email: normalizedEmail,
        passwordHash,
        role: "customer",
        phone: phone?.trim() || undefined,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      throw err;
    }

    res.status(201).json(toProfileResponse(user));
  }
);

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = await User.findById(req.params.id).select("-passwordHash -internalNotes -attachments");
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const isStaff = req.user!.role === "agent" || req.user!.role === "admin";
  const isSelf = req.user!.id === String(user._id);
  if (!isStaff && !isSelf) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return;
  }

  res.status(200).json(toProfileResponse(user));
});

router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const isSelf = req.user!.id === String(user._id);
  const isStaff = req.user!.role === "agent" || req.user!.role === "admin";
  if (!isSelf && !(isStaff && user.role === "customer")) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return;
  }

  const body = req.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return;
  }

  const bodyKeys = Object.keys(body);
  const unknownKey = bodyKeys.find((key) => !EDITABLE_FIELDS.includes(key as EditableField));
  if (unknownKey) {
    res.status(400).json({ error: `Field ${unknownKey} is not editable` });
    return;
  }
  if (bodyKeys.length === 0) {
    res.status(400).json({ error: "No editable fields provided" });
    return;
  }

  const updates: Partial<Pick<IUser, EditableField>> = {};

  if ("name" in body) {
    const name = body.name;
    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 200) {
      res.status(400).json({ error: "name must be a non-empty string" });
      return;
    }
    updates.name = name.trim();
  }

  if ("email" in body) {
    // Story 5 ("Maintain contact details"): a customer changing their OWN
    // email must go through the confirm-then-apply flow at
    // PATCH /api/v1/me/contact, not this immediate-apply endpoint — otherwise
    // this endpoint bypasses that story's entire confirmation flow. Staff
    // editing a *different* customer's record (isSelf === false here) is a
    // different trust boundary and keeps immediate-apply.
    if (isSelf) {
      res.status(400).json({
        error: "Update your email from account settings (PATCH /api/v1/me/contact) — it requires confirmation",
      });
      return;
    }
    const email = body.email;
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "valid email is required" });
      return;
    }
    updates.email = email.toLowerCase().trim();
  }

  if ("phone" in body) {
    const phone = body.phone;
    if (phone !== null && typeof phone !== "string") {
      res.status(400).json({ error: "phone must be a string or null" });
      return;
    }
    const trimmed = phone === null ? "" : phone.trim();
    if (trimmed !== "" && !isValidPhone(trimmed)) {
      res.status(400).json({ error: "phone must be a valid phone number" });
      return;
    }
    updates.phone = trimmed === "" ? undefined : trimmed;
  }

  if ("preferredLanguage" in body) {
    const preferredLanguage = body.preferredLanguage;
    if (preferredLanguage !== "en" && preferredLanguage !== "ar") {
      res.status(400).json({ error: "preferredLanguage must be 'en' or 'ar'" });
      return;
    }
    updates.preferredLanguage = preferredLanguage;
  }

  Object.assign(user, updates);

  try {
    await user.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    throw err;
  }

  res.status(200).json(toProfileResponse(user));
});

export default router;
