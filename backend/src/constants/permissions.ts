// Fixed permission vocabulary — see USER_STORIES.md security-admin Story 46.
// Permissions are granted PER INDIVIDUAL agent/sub-admin account (stored on
// User.permissions, see backend/src/models/User.ts) — there is no shared
// per-role permission set. Keys not yet backed by a real feature
// (sla:configure, kb:publish, ...) are reserved here, ready for the story
// that builds that feature to start gating its own routes with
// requirePermission(key) using one of these.
//
// The "staff:*" keys replace what used to be a single coarse "users:manage"
// key — every staff-account action (view the roster, view one account, edit
// its details, activate/deactivate, delete, change its granted permissions)
// is now independently grantable.
export const PERMISSION_KEYS = [
  "staff:view_list",
  "staff:view_account",
  "staff:edit",
  "staff:toggle_status",
  "staff:delete",
  "staff:permissions",
  "audit:view",
  "config:edit",
  "customers:manage",
  "tickets:delete",
  "tickets:reassign",
  "tickets:view_all",
  "tickets:create_for_customer",
  "tickets:categories_view",
  "tickets:categories_create",
  "tickets:categories_edit",
  "tickets:categories_toggle_status",
  "tickets:categorize",
  "tickets:change_priority",
  "tickets:reply",
  // Split in two (ticket-management Story 11) so an account can be granted
  // routine New/In Progress/Answered flips without also getting authority to
  // close/reopen a ticket, or vice versa.
  "tickets:change_status",
  "tickets:close_reopen",
  // ticket-management Story 12: manual escalation to a senior agent or
  // admin — agent-tier, same reasoning as tickets:change_status above (an
  // account can be granted this without also getting close/reopen or vice
  // versa).
  "tickets:escalate",
  "chats:manage",
  "sla:configure",
  "kb:publish",
  "reports:view",
  "reports:export",
  "ai:override_category",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type CreatableStaffRole = "agent" | "subadmin";

// Keys that can only ever be granted to a sub-admin account, never an agent
// — staff/system administration is a sub-admin-tier concern, agents are
// scoped to customer/ticket-facing work. Enforced server-side in
// admin.routes.ts's validatePermissions (not just hidden in the UI).
export const SUBADMIN_ONLY_PERMISSIONS: ReadonlySet<PermissionKey> = new Set([
  "staff:view_list",
  "staff:view_account",
  "staff:edit",
  "staff:toggle_status",
  "staff:delete",
  "staff:permissions",
  "audit:view",
  "config:edit",
  "sla:configure",
  "kb:publish",
  "reports:export",
  "tickets:categories_view",
  "tickets:categories_create",
  "tickets:categories_edit",
  "tickets:categories_toggle_status",
]);

export function permissionKeysAllowedForRole(role: CreatableStaffRole): readonly PermissionKey[] {
  if (role === "subadmin") return PERMISSION_KEYS;
  return PERMISSION_KEYS.filter((key) => !SUBADMIN_ONLY_PERMISSIONS.has(key));
}

// Suggested starting point when creating a new account via the admin UI's
// stepper (step 2 pre-fill) — a convenience default, not an enforced
// role-level set. The admin can freely adjust before or after creation;
// once created, permissions live entirely on that individual User document.
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<CreatableStaffRole, PermissionKey[]> = {
  agent: [
    "tickets:reassign",
    "reports:view",
    "ai:override_category",
    "tickets:create_for_customer",
    "tickets:categorize",
    "tickets:change_priority",
    "tickets:reply",
    "tickets:change_status",
    "tickets:close_reopen",
    "tickets:escalate",
    "chats:manage",
    // customers:manage added when agents started being gated on it (see
    // customer.routes.ts) — pre-existing agent accounts won't have it and
    // need a manual grant; no backfill migration exists for this.
    "customers:manage",
  ],
  subadmin: [],
};
