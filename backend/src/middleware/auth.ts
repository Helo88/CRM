import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../models/User";

export interface JwtPayload {
  sub: string;
  role: UserRole;
  // Rides along in the access token purely so the frontend nav can show a
  // display name/avatar-initial without an extra fetch on every page load
  // (see frontend/lib/jwt.ts) — never used for any authorization decision,
  // requireRole still only ever looks at `role`.
  name: string;
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
