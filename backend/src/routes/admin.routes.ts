import express, { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth";
import { User, IUser, UserRole } from "../models/User";
import { hasPermission } from "../services/permissions";
import {
  PERMISSION_KEYS,
  PermissionKey,
  CreatableStaffRole,
  SUBADMIN_ONLY_PERMISSIONS,
} from "../constants/permissions";

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// Valid roster/deactivation/edit/delete TARGETS — includes "admin" because
// admin accounts exist (DB-provisioned, see backend/scripts/seed-admin.ts)
// and must be visible/actionable here, even though they can't be CREATED
// through this router.
const STAFF_ROLES: UserRole[] = ["agent", "admin", "subadmin"];

// Valid roles this router can CREATE (or edit an account INTO). Deliberately
// excludes "admin" — see USER_STORIES.md Story 45: admin accounts are never
// created through the app, only provisioned directly in the database.
const CREATABLE_STAFF_ROLES: CreatableStaffRole[] = ["agent", "subadmin"];

function toStaffAccountResponse(user: IUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    membershipNumber: user.membershipNumber,
    role: user.role,
    isActive: user.isActive,
    isOnline: user.isOnline,
    permissions: user.permissions,
    createdAt: user.createdAt,
  };
}

// `targetRole` is the role the account HAS (edit) or WILL HAVE (create,
// when changing role) — a subadmin-only permission is never valid on an
// agent, checked here as well as filtered out client-side, since the UI
// restriction alone isn't a real boundary.
function validatePermissions(input: unknown, targetRole: UserRole): PermissionKey[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input) || !input.every((k) => typeof k === "string")) return null;
  if (!input.every((k) => (PERMISSION_KEYS as readonly string[]).includes(k))) return null;
  if (targetRole === "agent" && input.some((k) => SUBADMIN_ONLY_PERMISSIONS.has(k as PermissionKey))) return null;
  return Array.from(new Set(input)) as PermissionKey[];
}

// Shared by every action below whose real permission decision depends on
// the TARGET's role, not just the caller's — the target isn't known until
// the document loads, so this can't be plain route-level middleware.
// Returns true if the caller (req.user) is allowed to perform `requiredKey`
// on `target` — e.g. "staff:edit" for PATCH, "staff:delete" for DELETE.
async function canManageTarget(
  callerId: string,
  callerRole: UserRole,
  target: IUser,
  requiredKey: PermissionKey
): Promise<boolean> {
  if (callerRole === "admin") return true;
  if (target.role === "admin") return false; // hard cap — never delegable, see Story 46
  return hasPermission(callerId, requiredKey);
}

// security-admin Story 46: a sub-admin delegated agent/sub-admin account
// management needs to see the roster to act on it — admin always passes via
// requirePermission's own short-circuit. Excludes soft-deleted accounts.
router.get(
  "/",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  requirePermission("staff:view_list"),
  async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = { role: { $in: STAFF_ROLES }, isDeleted: { $ne: true } };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email membershipNumber role isActive isOnline permissions createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      users: users.map(toStaffAccountResponse),
      total,
      page,
      limit,
    });
  }
);

// Single-account detail — used by the frontend's edit stepper to prefill
// without refetching the whole paginated roster.
router.get(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  requirePermission("staff:view_account"),
  async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.status(200).json(toStaffAccountResponse(user));
  }
);

interface CreateStaffAccountBody {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  permissions?: unknown;
}

router.post(
  "/",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  // No admin-target cap needed on this route — CREATABLE_STAFF_ROLES already
  // excludes "admin" entirely, so there is nothing here for a delegated
  // sub-admin to escalate into.
  requirePermission("staff:edit"),
  async (req: Request<unknown, unknown, CreateStaffAccountBody>, res: Response) => {
    const { name, email, password, role } = req.body ?? {};

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "name, email, password, and role are required" });
      return;
    }
    if (!CREATABLE_STAFF_ROLES.includes(role as CreatableStaffRole)) {
      res.status(400).json({ error: "role must be one of: agent, subadmin" });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    const permissions = validatePermissions(req.body?.permissions, role as UserRole);
    if (permissions === null) {
      res.status(400).json({ error: "permissions must be an array of valid permission keys" });
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
        role: role as UserRole,
        permissions,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      throw err;
    }

    res.status(201).json(toStaffAccountResponse(user));
  }
);

interface UpdateStaffAccountBody {
  name?: string;
  email?: string;
  role?: string;
  permissions?: unknown;
}

// Edit an existing agent/sub-admin account (name/email/role/permissions).
// Admin accounts are never editable here — same DB-only boundary as creation.
router.patch(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  async (req: Request<{ id: string }, unknown, UpdateStaffAccountBody>, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const user = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    if (user.role === "admin") {
      res.status(400).json({ error: "Admin accounts cannot be edited here" });
      return;
    }
    const { name, email, role, permissions: permissionsInput } = req.body ?? {};

    if (role !== undefined && !CREATABLE_STAFF_ROLES.includes(role as CreatableStaffRole)) {
      res.status(400).json({ error: "role must be one of: agent, subadmin" });
      return;
    }

    const editingDetails = name !== undefined || email !== undefined || role !== undefined;
    const editingPermissions = permissionsInput !== undefined;
    if (
      (editingDetails && !(await canManageTarget(req.user!.id, req.user!.role, user, "staff:edit"))) ||
      (editingPermissions && !(await canManageTarget(req.user!.id, req.user!.role, user, "staff:permissions")))
    ) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }

    const resultingRole = (role as UserRole | undefined) ?? user.role;
    const permissions = validatePermissions(permissionsInput, resultingRole);
    if (permissions === null) {
      res.status(400).json({ error: "permissions must be an array of valid permission keys" });
      return;
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "name must be a non-empty string" });
        return;
      }
      user.name = name.trim();
    }
    if (email !== undefined) {
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "valid email is required" });
        return;
      }
      user.email = email.toLowerCase().trim();
    }
    if (role !== undefined) {
      user.role = role as UserRole;
    }
    if (permissionsInput !== undefined) {
      user.permissions = permissions;
    }

    try {
      await user.save();
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      throw err;
    }

    res.status(200).json(toStaffAccountResponse(user));
  }
);

async function setActiveState(req: Request, res: Response, isActive: boolean) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!user || !STAFF_ROLES.includes(user.role)) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  // security-admin Story 46's cap: acting on an existing "admin" account
  // always requires a true admin, regardless of staff:toggle_status — a
  // delegated sub-admin (or a granted agent) can never disable/enable a
  // higher-privileged account. Acting on an agent/subadmin target is
  // delegable via staff:toggle_status, same as create/roster above.
  if (!(await canManageTarget(req.user!.id, req.user!.role, user, "staff:toggle_status"))) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return;
  }

  user.isActive = isActive;
  if (user.role === "agent" && !isActive) {
    user.isOnline = false;
  }
  await user.save();

  res.status(200).json(toStaffAccountResponse(user));
}

router.patch(
  "/:id/deactivate",
  requireAuth,
  // The target's role isn't known until the document loads, so the real
  // permission decision happens INSIDE setActiveState — this just filters
  // out callers who could never pass either branch.
  requireRole("agent", "admin", "subadmin"),
  (req: Request, res: Response) => setActiveState(req, res, false)
);

router.patch(
  "/:id/activate",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  (req: Request, res: Response) => setActiveState(req, res, true)
);

// Soft delete — hides the account from the roster and locks it out
// entirely, but keeps the document for referential integrity (past ticket
// assignments, audit log entries). No restore action exists yet.
router.delete(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const user = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    if (!(await canManageTarget(req.user!.id, req.user!.role, user, "staff:delete"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }

    user.isDeleted = true;
    user.isActive = false;
    if (user.role === "agent") {
      user.isOnline = false;
    }
    await user.save();

    res.status(204).send();
  }
);

export default router;
