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

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Theme switching now lives in its own header button (ThemeToggleButton) —
// pulled out of this dropdown so it's a single click, matching the
// reference header's separate control cluster.
export function UserMenu({
  name,
  locale,
  inlineName = false,
}: {
  name: string;
  locale: Locale;
  inlineName?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("UserMenu");
  const tAuth = useTranslations("Auth");
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  function toggleLocale() {
    const next: Locale = locale === "en" ? "ar" : "en";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 items-center gap-2 rounded-2xl ps-1 pe-2.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          <AvatarFallback className="bg-accent text-accent-foreground">{initial}</AvatarFallback>
        </Avatar>
        {inlineName && (
          <>
            <span className="hidden max-w-[9rem] truncate text-sm font-semibold sm:inline">{name}</span>
            <ChevronDown className="hidden size-4 text-muted-foreground sm:inline" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
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
