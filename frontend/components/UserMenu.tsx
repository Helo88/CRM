"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
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
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { LOCALE_COOKIE, type Locale } from "@/lib/locale";
import { logout } from "@/app/actions";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function UserMenu({
  name,
  theme: initialTheme,
  locale,
}: {
  name: string;
  theme: Theme;
  locale: Locale;
}) {
  const router = useRouter();
  const t = useTranslations("UserMenu");
  const tAuth = useTranslations("Auth");
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  function toggleTheme() {
    const next: Theme = initialTheme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    // Refresh so the next Server Component render (and this component's own
    // props) picks up the new value too — the class toggle above is just
    // for instant visual feedback in the meantime.
    router.refresh();
  }

  function toggleLocale() {
    const next: Locale = locale === "en" ? "ar" : "en";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Avatar>
          <AvatarFallback className="bg-accent text-accent-foreground">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">{t("profile")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleTheme}>
          {initialTheme === "dark" ? <Sun /> : <Moon />}
          {initialTheme === "dark" ? t("lightMode") : t("darkMode")}
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
