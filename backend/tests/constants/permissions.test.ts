import {
  PERMISSION_KEYS,
  SUBADMIN_ONLY_PERMISSIONS,
  permissionKeysAllowedForRole,
} from "../../src/constants/permissions";

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
