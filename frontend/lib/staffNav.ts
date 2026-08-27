import { LayoutDashboard, Users, ShieldUser } from "lucide-react";

// Shared between the desktop hover-expand rail and the mobile drawer
// (components/StaffSidebar.tsx, components/MobileStaffNav.tsx) so both stay
// in sync. "accounts" is visible to admin and sub-admin — permissions are
// granted per individual account, so a sub-admin may or may not actually be
// able to use the page; the page itself handles a 403 gracefully, same as
// "customers" already does for a non-staff viewer.
export const STAFF_NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, staffOnly: false },
  { key: "customers", href: "/customers", icon: Users, staffOnly: false },
  { key: "accounts", href: "/admin/users", icon: ShieldUser, staffOnly: true },
] as const;

export type StaffNavKey = (typeof STAFF_NAV_ITEMS)[number]["key"];

export function visibleStaffNavItems(role: string | undefined) {
  return STAFF_NAV_ITEMS.filter((item) => !item.staffOnly || role === "admin" || role === "subadmin");
}
