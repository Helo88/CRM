import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar";
import { SidebarCollapseToggle } from "./SidebarCollapseToggle";

// Reuses the --sidebar-* tokens already reserved in globals.css for exactly
// this kind of section — they'd been unused until now. Only one item today
// (Customers); more staff-only pages (agent-workspace, security-admin's
// account management, ...) are expected to land here later per
// USER_STORIES.md, so this takes an `active` key rather than being
// hardcoded to a single page.
const NAV_ITEMS = [{ key: "customers", href: "/customers", icon: Users }] as const;

export async function StaffSidebar({ active }: { active: (typeof NAV_ITEMS)[number]["key"] }) {
  const t = await getTranslations("Nav");
  const tSidebar = await getTranslations("StaffSidebar");
  const cookieStore = await cookies();
  // Collapsed preference persists via cookie, resolved server-side — same
  // pattern as theme/locale (lib/theme.ts, lib/locale.ts) — so there's no
  // flash of the wrong width on load, and SidebarCollapseToggle's
  // router.refresh() re-reads it correctly on toggle.
  const collapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";

  return (
    <aside
      className={cn(
        "shrink-0 border-e border-sidebar-border bg-sidebar p-3 transition-[width] duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className={cn("mb-2 flex", collapsed ? "justify-center" : "justify-end")}>
        <SidebarCollapseToggle
          collapsed={collapsed}
          expandLabel={tSidebar("expand")}
          collapseLabel={tSidebar("collapse")}
        />
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? t(item.key) : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                item.key === active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{t(item.key)}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
