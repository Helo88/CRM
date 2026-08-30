import { LayoutDashboard, Users, ShieldUser, Ticket, MessageSquare, TicketPlus, UserPlus, ShieldPlus, Tags } from "lucide-react";

// Shared between the desktop hover-expand rail and the mobile drawer
// (components/StaffSidebar.tsx, components/MobileStaffNav.tsx) so both stay
// in sync. "accounts" (/admin/users) is gated on the exact permission its
// own GET requires — staff:view_list — not just the admin/subadmin role,
// since a sub-admin without it gets a real 403 from that page (see
// app/admin/users/page.tsx's own comment on this). "chats" (Story 18) uses
// `agentOrAdminOnly` instead — its backend route is `requireRole("agent",
// "admin")` with no permission-delegation path at all, so a sub-admin (even
// with every permission granted) still gets a real 403 there; the nav item
// must never be offered to one.
export const STAFF_NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, staffOnly: false, agentOrAdminOnly: false, permission: undefined },
  { key: "customers", href: "/customers", icon: Users, staffOnly: false, agentOrAdminOnly: false, permission: undefined },
  { key: "tickets", href: "/tickets", icon: Ticket, staffOnly: false, agentOrAdminOnly: false, permission: undefined },
  { key: "chats", href: "/chats", icon: MessageSquare, staffOnly: false, agentOrAdminOnly: true, permission: undefined },
  { key: "accounts", href: "/admin/users", icon: ShieldUser, staffOnly: true, agentOrAdminOnly: false, permission: "staff:view_list" },
] as const;

export type StaffNavKey = (typeof STAFF_NAV_ITEMS)[number]["key"];

export function visibleStaffNavItems(role: string | undefined, permissions: string[] = []) {
  return STAFF_NAV_ITEMS.filter((item) => {
    if (item.agentOrAdminOnly) return role === "agent" || role === "admin";
    if (!item.staffOnly) return true;
    if (role === "admin") return true;
    return role === "subadmin" && (!item.permission || permissions.includes(item.permission));
  });
}

// Quick-create actions surfaced in the header search (HeaderSearch), not
// destinations to browse. Each entry's visibility mirrors its own
// destination page's real access check exactly — a link a click would just
// redirect away from isn't offered here (same rule customer.routes.ts's
// roster already follows for row-level links: don't render a link a click
// would just bounce off of). Where the destination page checks a specific
// permission (not just role) for a sub-admin, `permission` names it — a
// sub-admin lacking it doesn't get offered the entry, same as it doesn't
// get a working "accounts" nav item above without staff:view_list.
export const STAFF_ACTION_ITEMS = [
  // /tickets/new (ticket-management Story 8/57) renders customer-submit
  // mode for a customer and staff-create-for-customer mode for
  // agent/admin/subadmin — every staff role reaches a working form here,
  // even one lacking tickets:create_for_customer (the backend 403 surfaces
  // as an in-form alert, not a dead page).
  { key: "newTicket", href: "/tickets/new", icon: TicketPlus, agentOrAdminOnly: false, staffOnly: false, permission: undefined },
  // customers/new/page.tsx redirects anyone who isn't exactly "agent" or
  // "admin" (a subadmin included) — matches that exact check.
  { key: "newCustomer", href: "/customers/new", icon: UserPlus, agentOrAdminOnly: true, staffOnly: false, permission: undefined },
  // admin/users/new/page.tsx requires role "admin" or permission staff:edit
  // (a sub-admin delegated staff:edit, same key the POST itself requires).
  { key: "newStaffAccount", href: "/admin/users/new", icon: ShieldPlus, agentOrAdminOnly: false, staffOnly: true, permission: "staff:edit" },
  // Story 58: admin/ticket-categories/page.tsx's GET requires
  // tickets:categories_view — a sub-admin without it gets a real 403 there.
  { key: "manageTicketCategories", href: "/admin/ticket-categories", icon: Tags, agentOrAdminOnly: false, staffOnly: true, permission: "tickets:categories_view" },
] as const;

export function visibleStaffActionItems(role: string | undefined, permissions: string[] = []) {
  return STAFF_ACTION_ITEMS.filter((item) => {
    if (item.agentOrAdminOnly) return role === "agent" || role === "admin";
    if (!item.staffOnly) return true;
    if (role === "admin") return true;
    return role === "subadmin" && (!item.permission || permissions.includes(item.permission));
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
