import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../models/User";
import { hasPermission } from "../services/permissions";
import type { PermissionKey } from "../constants/permissions";

export interface JwtPayload {
  sub: string;
  role: UserRole;
  // Rides along in the access token purely so the frontend nav can show a
  // display name/avatar-initial without an extra fetch on every page load
  // (see frontend/lib/jwt.ts) — never used for any authorization decision,
  // requireRole still only ever looks at `role`.
  name: string;
  // Same reasoning as `name` — shows in the account menu without a fetch.
  email: string;
  // UI-only nicety, same as the two fields above: lets the staff roster
  // decide which action icons (edit/toggle-status/delete) to render for the
  // signed-in viewer without a fetch. Stale until the token is next
  // reissued if permissions change mid-session — acceptable, same
  // staleness `role` itself already has. NEVER used for authorization —
  // requirePermission always re-checks the live DB value.
  permissions: string[];
  // Same reasoning as `name` — lets the header show it without a fetch.
  // Never changes once assigned (see User.ts), so no refresh-staleness
  // concern the way a mutable field would have.
  membershipNumber: string;
}

/**
 * Verifies the JWT on the Authorization header and attaches { id, role } to req.user.
 * Implements the "Role-based access control" story (auth feature, Story 3).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Restricts a route to one or more roles. Use after requireAuth.
 * Example: router.get('/admin/agents', requireAuth, requireRole('admin'), handler)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

/**
 * Restricts a route to callers holding a specific permission. Use after
 * requireAuth. `admin` always passes (full/main admin, fixed, never
 * configurable). `agent`/`subadmin` are checked against a LIVE DB lookup of
 * THEIR OWN individual account (backend/src/services/permissions.ts's
 * hasPermission) on every request — no caching, so a permission change
 * takes effect on the very next request. Permissions are granted per
 * individual agent/sub-admin account, not per role (security-admin Story
 * 46) — there is no shared role-level default enforced here. Any other
 * role (customer, or no req.user) is rejected outright.
 * Example: router.get('/admin/users', requireAuth, requirePermission('staff:view_list'), handler)
 */
export function requirePermission(key: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    if (req.user.role === "admin") {
      next();
      return;
    }
    if (req.user.role !== "agent" && req.user.role !== "subadmin") {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    const granted = await hasPermission(req.user.id, key);
    if (!granted) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}
