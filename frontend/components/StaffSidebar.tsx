import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

// Reuses the --sidebar-* tokens already reserved in globals.css for exactly
// this kind of section — they'd been unused until now. Only one item today
// (Customers); more staff-only pages (agent-workspace, security-admin's
// account management, ...) are expected to land here later per
// USER_STORIES.md, so this takes an `active` key rather than being
// hardcoded to a single page.
const NAV_ITEMS = [{ key: "customers", href: "/customers" }] as const;

export async function StaffSidebar({ active }: { active: (typeof NAV_ITEMS)[number]["key"] }) {
  const t = await getTranslations("Nav");

  return (
    <aside className="w-56 shrink-0 border-e border-sidebar-border bg-sidebar p-4">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              item.key === active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
