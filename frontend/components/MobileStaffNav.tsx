"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { STAFF_NAV_ITEMS, visibleStaffNavItems, type StaffNavKey } from "@/lib/staffNav";

// Mobile counterpart to the desktop hover-expand rail (StaffSidebar) — a
// hamburger trigger + full-height drawer with labeled nav items, same
// pattern as the reference app's mobile nav.
export function MobileStaffNav({ active, role }: { active: StaffNavKey; role?: string }) {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const visibleItems = visibleStaffNavItems(role);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t("menu")}>
        <Menu className="size-5" />
      </Button>
      <SheetContent side="left" className="w-72">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="text-lg font-bold tracking-tight">{t("brand")}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.8} />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

// Re-exported so callers only need one import for the shared nav vocabulary.
export { STAFF_NAV_ITEMS };
