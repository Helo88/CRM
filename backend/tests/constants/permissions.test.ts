import {
  PERMISSION_KEYS,
  SUBADMIN_ONLY_PERMISSIONS,
  permissionKeysAllowedForRole,
  DEFAULT_PERMISSIONS_BY_ROLE,
} from "../../src/constants/permissions";

// Story 58: tickets:manage_categories is an admin/system-configuration-tier
// key (same as config:edit/sla:configure), unlike Story 57's
// tickets:create_for_customer — the generic assertions below don't catch a
// specific key's tier by name, so this needs its own explicit check.
describe("tickets:manage_categories (Story 58)", () => {
  it("is a recognized permission key", () => {
    expect(PERMISSION_KEYS).toContain("tickets:manage_categories");
  });

  it("is sub-admin-tier (never assignable to an agent)", () => {
    expect(SUBADMIN_ONLY_PERMISSIONS.has("tickets:manage_categories")).toBe(true);
  });

  it("is not granted by default to a freshly-created agent or sub-admin", () => {
    expect(DEFAULT_PERMISSIONS_BY_ROLE.agent).not.toContain("tickets:manage_categories");
    expect(DEFAULT_PERMISSIONS_BY_ROLE.subadmin).not.toContain("tickets:manage_categories");
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
