// Fixed permission vocabulary — see USER_STORIES.md security-admin Story 46.
// Permissions are granted PER INDIVIDUAL agent/sub-admin account (stored on
// User.permissions, see backend/src/models/User.ts) — there is no shared
// per-role permission set. Keys not yet backed by a real feature
// (sla:configure, kb:publish, ...) are reserved here, ready for the story
// that builds that feature to start gating its own routes with
// requirePermission(key) using one of these.
export const PERMISSION_KEYS = [
  "users:manage",
  "users:permissions",
  "audit:view",
  "config:edit",
  "customers:manage",
  "tickets:delete",
  "tickets:reassign",
  "tickets:view_all",
  "sla:configure",
  "kb:publish",
  "reports:view",
  "reports:export",
  "ai:override_category",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type CreatableStaffRole = "agent" | "subadmin";

// Suggested starting point when creating a new account via the admin UI's
// stepper (step 2 pre-fill) — a convenience default, not an enforced
// role-level set. The admin can freely adjust before or after creation;
// once created, permissions live entirely on that individual User document.
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<CreatableStaffRole, PermissionKey[]> = {
  agent: ["tickets:reassign", "reports:view", "ai:override_category"],
  subadmin: [],
};
