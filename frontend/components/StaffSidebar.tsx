import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { SESSION_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { visibleStaffNavItems, type StaffNavKey } from "@/lib/staffNav";

// A pure-CSS hover-to-expand rail (icons only at rest, widens to show
// labels on hover) — no persisted collapse state, no click target. Fixed
// below the 57px SiteHeader; the sibling spacer div in the page's own flex
// row reserves its resting width so content doesn't jump when it expands.
// Desktop only — below the md breakpoint this renders nothing at all;
// SiteHeader's MobileStaffNav (inline with the other header icons) is the
// mobile equivalent, not a second bar owned by this component.
export async function StaffSidebar({ active }: { active?: StaffNavKey }) {
  const t = await getTranslations("Nav");
  const cookieStore = await cookies();
  // Unverified peek, same pattern as SiteHeader/customers-new-page — a UI
  // nicety only; the backend's requireRole/requirePermission is the real boundary.
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const { role } = accessToken ? peekJwtPayload(accessToken) : {};
  const visibleItems = visibleStaffNavItems(role);

  return (
    <>
      <div className="hidden w-20 shrink-0 md:block" aria-hidden />
      <aside className="group/rail fixed inset-y-0 start-0 top-[57px] z-30 hidden w-20 flex-col overflow-hidden border-e border-sidebar-border bg-sidebar py-4 transition-[width] duration-200 ease-out hover:w-56 hover:shadow-pop md:flex">
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                title={t(item.key)}
                className="mx-3 flex h-11 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-sidebar-accent"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground"
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={1.8} />
                </span>
                <span
                  className={cn(
                    "animate-fade-in whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100",
                    isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/80"
                  )}
                >
                  {t(item.key)}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
