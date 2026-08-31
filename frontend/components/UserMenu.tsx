"use client";

import { useEffect, useState } from "react";
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
import { getAvailability, setAvailability } from "@/app/actions/availability";
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
  role,
  inlineName = false,
  viewProfileHref,
}: {
  name: string;
  email?: string;
  membershipNumber?: string;
  locale: Locale;
  // Story 21 (agent-workspace), scoped down to just the flag + this toggle,
  // not the full dashboard — see .squad/stories/agent-workspace/
  // agent-availability-toggle/intake.md. Only agents get the item below.
  role?: string;
  inlineName?: boolean;
  // Customer-only: links to /customers/[id]'s richer profile (name/email/
  // phone plus the notes/attachments gallery step). Used to sit alongside a
  // second, separate "Profile" item pointing at /settings — merged into one
  // entry since a customer never needed both (there was nothing on the
  // /settings copy that this page didn't already cover).
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

  const isAgent = role === "agent";
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [availabilityPending, setAvailabilityPending] = useState(false);

  // Hydrate on mount rather than from the header's JWT decode — isOnline
  // isn't (and shouldn't be) baked into the access token, so this is the one
  // piece of UserMenu that needs its own round-trip.
  useEffect(() => {
    if (!isAgent) return;
    let cancelled = false;
    getAvailability().then((value) => {
      if (!cancelled) setIsOnline(value);
    });
    return () => {
      cancelled = true;
    };
  }, [isAgent]);

  async function toggleAvailability(event: Event) {
    event.preventDefault();
    if (isOnline === null || availabilityPending) return;
    const next = !isOnline;
    setIsOnline(next); // optimistic
    setAvailabilityPending(true);
    const result = await setAvailability(next);
    setAvailabilityPending(false);
    if (!result.ok) {
      setIsOnline(!next); // revert
    }
  }

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
        {isAgent && isOnline !== null && (
          <DropdownMenuItem onSelect={toggleAvailability}>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-2 shrink-0 rounded-full",
                  isOnline ? "bg-success" : "bg-muted-foreground/40"
                )}
              />
              {isOnline ? t("availabilityOnline") : t("availabilityOffline")}
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={viewProfileHref ?? "/settings"}>{viewProfileHref ? t("myProfile") : t("profile")}</Link>
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
