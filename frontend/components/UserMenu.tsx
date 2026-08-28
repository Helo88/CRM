"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LOCALE_COOKIE, type Locale } from "@/lib/locale";
import { logout } from "@/app/actions";
import { cn } from "@/lib/utils";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Theme switching now lives in its own header button (ThemeToggleButton) —
// pulled out of this dropdown so it's a single click, matching the
// reference header's separate control cluster.
export function UserMenu({
  name,
  email,
  membershipNumber,
  locale,
  inlineName = false,
  viewProfileHref,
}: {
  name: string;
  email?: string;
  membershipNumber?: string;
  locale: Locale;
  inlineName?: boolean;
  // Customer-only (Story 7): links to /customers/[id]'s richer profile
  // (name/email/phone plus the notes/attachments gallery step) — distinct
  // from "profile" below, which is Story 5's contact-only settings page.
  // Staff never get this — /customers/[id] is a customer-facing surface.
  viewProfileHref?: string;
}) {
  const router = useRouter();
  const t = useTranslations("UserMenu");
  const tAuth = useTranslations("Auth");
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  // A customer has a membership number to show off; staff/admin don't, but
  // do have an email worth surfacing here instead — matching the reference
  // header's "name / email" pairing.
  const secondaryLine = membershipNumber ? t("memberNumber", { number: membershipNumber }) : email;

  function toggleLocale() {
    const next: Locale = locale === "en" ? "ar" : "en";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-2xl ps-1 pe-2.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          inlineName ? "h-12" : "h-10"
        )}
      >
        <Avatar>
          <AvatarFallback className="bg-accent text-accent-foreground">{initial}</AvatarFallback>
        </Avatar>
        {inlineName && (
          <>
            <span className="hidden flex-col items-start sm:flex">
              <span className="max-w-[9rem] truncate text-sm font-semibold leading-tight">{name}</span>
              {secondaryLine && (
                <span className="max-w-[9rem] truncate text-xs leading-tight text-muted-foreground">
                  {secondaryLine}
                </span>
              )}
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground sm:inline" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold leading-tight">{name}</span>
          {secondaryLine && (
            <span className="truncate text-xs font-normal leading-tight text-muted-foreground">{secondaryLine}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {viewProfileHref && (
          <DropdownMenuItem asChild>
            <Link href={viewProfileHref}>{t("myProfile")}</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/settings">{t("profile")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleLocale}>
          {locale === "en" ? t("switchToArabic") : t("switchToEnglish")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
          {tAuth("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
