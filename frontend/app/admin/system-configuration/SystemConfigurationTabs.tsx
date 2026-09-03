"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tags, Timer, MessageSquareText, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

// security-admin Story 48, pulled forward by sla-automation Story 25: a
// shared tab strip over /admin/system-configuration/*. Real routes, not a
// client-side panel swap — each tab is its own independently server-rendered
// page.tsx; this component only renders the strip + active-state styling.
const TABS = [
  { key: "categories", href: "/admin/system-configuration/categories", icon: Tags, iconColorClass: "text-icon-category" },
  { key: "slaTargets", href: "/admin/system-configuration/sla-targets", icon: Timer, iconColorClass: "text-icon-date" },
  { key: "quickReplies", href: "/admin/system-configuration/quick-replies", icon: MessageSquareText, iconColorClass: "text-icon-status" },
] as const;

export function SystemConfigurationTabs() {
  const t = useTranslations("SystemConfiguration");
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {/* Vibrant per-tab icon colors — a decorative/categorical accent,
                same convention as TicketFilterBar's text-icon-* usage, kept
                even when the tab isn't active (unlike the label, whose color
                does follow active state). */}
            <Icon className={cn("size-4", tab.iconColorClass)} />
            {t(`tabs.${tab.key}`)}
          </Link>
        );
      })}
      <span
        className="flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-muted-foreground/50"
        title={t("tabs.brandingSoon")}
      >
        <Palette className="size-4" />
        {t("tabs.branding")}
        <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("tabs.soon")}
        </span>
      </span>
    </div>
  );
}
