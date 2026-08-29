"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { visibleStaffNavItems, activeStaffNavKey } from "@/lib/staffNav";

// Mobile counterpart to the desktop hover-expand rail (StaffSidebar) —
// rendered once from SiteHeader (inline with the other header icons, not a
// separate bar) so it's a Client Component that works out which nav item is
// "active" itself, from the URL, instead of needing a per-page prop.
export function MobileStaffNav({ role }: { role?: string }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleItems = visibleStaffNavItems(role);
  const active = activeStaffNavKey(pathname);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="icon"
        className="rounded-xl border-border bg-card shadow-soft md:hidden"
        onClick={() => setOpen(true)}
        aria-label={t("menu")}
      >
        <Menu className="size-[17px]" />
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
