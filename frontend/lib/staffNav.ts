import { LayoutDashboard, Users, ShieldUser, TicketPlus, UserPlus, ShieldPlus } from "lucide-react";

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

// Quick-create actions surfaced in the header search (HeaderSearch), not
// destinations to browse. Each entry's visibility mirrors its own
// destination page's real access check exactly — a link a click would just
// redirect away from isn't offered here (same rule customer.routes.ts's
// roster already follows for row-level links: don't render a link a click
// would just bounce off of).
export const STAFF_ACTION_ITEMS = [
  // /tickets/new (ticket-management Story 8/57) renders customer-submit
  // mode for a customer and staff-create-for-customer mode for
  // agent/admin/subadmin — every staff role reaches a working form here,
  // even one lacking tickets:create_for_customer (the backend 403 surfaces
  // as an in-form alert, not a dead page).
  { key: "newTicket", href: "/tickets/new", icon: TicketPlus, agentOrAdminOnly: false, staffOnly: false },
  // customers/new/page.tsx redirects anyone who isn't exactly "agent" or
  // "admin" (a subadmin included) — matches that exact check.
  { key: "newCustomer", href: "/customers/new", icon: UserPlus, agentOrAdminOnly: true, staffOnly: false },
  // Same visibility as the "accounts" nav item above (admin/subadmin only).
  { key: "newStaffAccount", href: "/admin/users/new", icon: ShieldPlus, agentOrAdminOnly: false, staffOnly: true },
] as const;

export function visibleStaffActionItems(role: string | undefined) {
  return STAFF_ACTION_ITEMS.filter((item) => {
    if (item.staffOnly && role !== "admin" && role !== "subadmin") return false;
    if (item.agentOrAdminOnly && role !== "agent" && role !== "admin") return false;
    return true;
  });
}

// Derives which nav item is "active" from the current URL instead of a
// prop threaded down from each page — lets a single client component (the
// mobile drawer trigger, rendered once from SiteHeader) work correctly on
// every staff page without per-page wiring. Longest-prefix match, most
// specific href first, so "/admin/users" doesn't shadow a future
// "/admin/users/settings"-style route in the wrong direction.
export function activeStaffNavKey(pathname: string): StaffNavKey | undefined {
  const sorted = [...STAFF_NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.key;
}
