import { User } from "../models/User";
import { PermissionKey } from "../constants/permissions";

// Shared by requirePermission (middleware/auth.ts) and any route that needs
// to check a permission mid-handler rather than as route-level middleware
// (e.g. admin.routes.ts's PATCH /:id/deactivate, which only knows whether
// the check applies once it has loaded the target document). Live DB lookup
// against the CALLER's own User document, no caching — a permission change
// must take effect on the very next request. Permissions are per individual
// account (security-admin Story 46) — there is no role-level fallback.
//
// Also re-checks isActive here, not just permissions: requireAuth
// (middleware/auth.ts) is deliberately stateless (JWT-only, no DB lookup),
// so a deactivated agent/sub-admin's still-unexpired access token would
// otherwise keep passing requirePermission-gated routes until it naturally
// expires (~15 min) — confirmed live: a sub-admin deactivated mid-session
// kept getting 200s from a requirePermission-gated route on its old token
// until this check was added. isDeleted needs no separate check — soft
// delete (admin.routes.ts's DELETE /:id) always sets isActive false too.
export async function hasPermission(userId: string, key: PermissionKey): Promise<boolean> {
  const doc = await User.findById(userId).select("permissions isActive").lean();
  if (!doc?.isActive) return false;
  return Boolean(doc.permissions?.includes(key));
}

// Same isActive re-check as hasPermission above, for the call sites that
// short-circuit an admin (or, in customer.routes.ts, an agent too) straight
// to "allowed" without ever consulting `permissions` — requirePermission's
// own admin branch, admin.routes.ts's canManageTarget, and
// customer.routes.ts's isFullStaffViewer/staffOrDelegatedSubadmin all did
// this with zero DB lookup, so a deactivated admin/agent's still-unexpired
// token sailed through every one of them. Confirmed live for both an agent
// (customer.routes.ts's role-only path) and a subadmin before this existed.
export async function isActiveAccount(userId: string): Promise<boolean> {
  const doc = await User.findById(userId).select("isActive").lean();
  return Boolean(doc?.isActive);
}

// Same live-DB, no-cache, isActive-re-checking contract as hasPermission —
// for the handful of actions legitimately reachable by more than one key
// (knowledge-base Story 29: the AI draft-translate assist is useful to both
// a create-only and an edit-only FAQ/article author). Callers still
// short-circuit `admin` themselves via isActiveAccount, exactly like
// requirePermission does.
export async function hasAnyPermission(userId: string, keys: PermissionKey[]): Promise<boolean> {
  const doc = await User.findById(userId).select("permissions isActive").lean();
  if (!doc?.isActive) return false;
  return keys.some((key) => Boolean(doc.permissions?.includes(key)));
}
