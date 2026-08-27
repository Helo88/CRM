import { User } from "../models/User";
import { PermissionKey } from "../constants/permissions";

// Shared by requirePermission (middleware/auth.ts) and any route that needs
// to check a permission mid-handler rather than as route-level middleware
// (e.g. admin.routes.ts's PATCH /:id/deactivate, which only knows whether
// the check applies once it has loaded the target document). Live DB lookup
// against the CALLER's own User document, no caching — a permission change
// must take effect on the very next request. Permissions are per individual
// account (security-admin Story 46) — there is no role-level fallback.
export async function hasPermission(userId: string, key: PermissionKey): Promise<boolean> {
  const doc = await User.findById(userId).select("permissions").lean();
  return Boolean(doc?.permissions?.includes(key));
}
