import {
  PERMISSION_KEYS,
  SUBADMIN_ONLY_PERMISSIONS,
  permissionKeysAllowedForRole,
  DEFAULT_PERMISSIONS_BY_ROLE,
} from "../../src/constants/permissions";

// Story 58: ticket categories get one permission key per distinct action
// (view/create/edit/toggle-status) rather than one umbrella key — see
// [[feedback_granular_action_permissions]]. All four are admin/system-
// configuration-tier (same as config:edit/sla:configure), unlike Story 57's
// tickets:create_for_customer — the generic assertions below don't catch a
// specific key's tier by name, so this needs its own explicit check.
describe("tickets:categories_* (Story 58)", () => {
  const CATEGORY_KEYS = [
    "tickets:categories_view",
    "tickets:categories_create",
    "tickets:categories_edit",
    "tickets:categories_toggle_status",
  ] as const;

  it("are all recognized permission keys", () => {
    for (const key of CATEGORY_KEYS) {
      expect(PERMISSION_KEYS).toContain(key);
    }
  });

  it("are all sub-admin-tier (never assignable to an agent)", () => {
    for (const key of CATEGORY_KEYS) {
      expect(SUBADMIN_ONLY_PERMISSIONS.has(key)).toBe(true);
    }
  });

  it("are not granted by default to a freshly-created agent or sub-admin", () => {
    for (const key of CATEGORY_KEYS) {
      expect(DEFAULT_PERMISSIONS_BY_ROLE.agent).not.toContain(key);
      expect(DEFAULT_PERMISSIONS_BY_ROLE.subadmin).not.toContain(key);
    }
  });
});

// Story 9: unlike Story 58's category-management keys, these two are
// day-to-day agent actions — agent-tier by default, never subadmin-only.
describe("tickets:categorize / tickets:change_priority (Story 9)", () => {
  const STORY_9_KEYS = ["tickets:categorize", "tickets:change_priority"] as const;

  it("are all recognized permission keys", () => {
    for (const key of STORY_9_KEYS) {
      expect(PERMISSION_KEYS).toContain(key);
    }
  });

  it("are not sub-admin-only", () => {
    for (const key of STORY_9_KEYS) {
      expect(SUBADMIN_ONLY_PERMISSIONS.has(key)).toBe(false);
    }
  });

  it("are granted by default to a freshly-created agent", () => {
    for (const key of STORY_9_KEYS) {
      expect(DEFAULT_PERMISSIONS_BY_ROLE.agent).toContain(key);
    }
  });
});

// Story 56: a day-to-day agent action, same tier as tickets:categorize/
// tickets:change_priority — never sub-admin-only.
describe("tickets:reply (Story 56)", () => {
  it("is a recognized permission key", () => {
    expect(PERMISSION_KEYS).toContain("tickets:reply");
  });

  it("is not sub-admin-only", () => {
    expect(SUBADMIN_ONLY_PERMISSIONS.has("tickets:reply")).toBe(false);
  });

  it("is granted by default to a freshly-created agent", () => {
    expect(DEFAULT_PERMISSIONS_BY_ROLE.agent).toContain("tickets:reply");
  });
});

// Story 11: split into two keys (not one) so an account can be granted
// routine New/In Progress/Answered flips without also getting authority to
// close/reopen, or vice versa — same day-to-day agent tier as Story 9's
// categorize/change_priority keys above, never sub-admin-only.
describe("tickets:change_status / tickets:close_reopen (Story 11)", () => {
  const STORY_11_KEYS = ["tickets:change_status", "tickets:close_reopen"] as const;

  it("are all recognized permission keys", () => {
    for (const key of STORY_11_KEYS) {
      expect(PERMISSION_KEYS).toContain(key);
    }
  });

  it("are not sub-admin-only", () => {
    for (const key of STORY_11_KEYS) {
      expect(SUBADMIN_ONLY_PERMISSIONS.has(key)).toBe(false);
    }
  });

  it("are granted by default to a freshly-created agent", () => {
    for (const key of STORY_11_KEYS) {
      expect(DEFAULT_PERMISSIONS_BY_ROLE.agent).toContain(key);
    }
  });

  it("are not granted by default to a freshly-created customer role (no such default exists)", () => {
    // customer isn't a CreatableStaffRole at all — DEFAULT_PERMISSIONS_BY_ROLE
    // only covers agent/subadmin, so there is no customer default to check
    // against; this test documents that a customer can never be granted
    // either key through this mechanism, not just that it defaults to none.
    expect(Object.keys(DEFAULT_PERMISSIONS_BY_ROLE)).not.toContain("customer");
  });
});

describe("permissionKeysAllowedForRole", () => {
  it("returns every permission key for subadmin", () => {
    expect(permissionKeysAllowedForRole("subadmin")).toEqual(PERMISSION_KEYS);
  });

  it("excludes every subadmin-only key for agent", () => {
    const allowed = permissionKeysAllowedForRole("agent");
    for (const key of SUBADMIN_ONLY_PERMISSIONS) {
      expect(allowed).not.toContain(key);
    }
  });

  it("still includes every non-subadmin-only key for agent", () => {
    const allowed = permissionKeysAllowedForRole("agent");
    const nonSubadminOnly = PERMISSION_KEYS.filter((key) => !SUBADMIN_ONLY_PERMISSIONS.has(key));
    expect([...allowed].sort()).toEqual([...nonSubadminOnly].sort());
  });
});
