import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { LOCALE_COOKIE, DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { HeaderSearch } from "@/components/HeaderSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { LocaleToggleButton } from "@/components/LocaleToggleButton";
import { MobileStaffNav } from "@/components/MobileStaffNav";

// Present on every page (rendered from RootLayout) so there's always a way
// back home and, for a signed-in user, a way to reach their profile,
// switch theme/language, or sign out without navigating to "/" first.
// Staff get the fuller control cluster (search, notifications, standalone
// theme button) — customers get the plain version, since there's nothing
// staff-only to search or be notified about from their side.
export async function SiteHeader() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  // Either cookie counts as signed-in, not just the access token — its short
  // ~15min maxAge means it's routinely absent for an otherwise-valid session
  // (see proxy.ts). This is a presence-only UI nicety, not a security check.
  const isSignedIn = Boolean(accessToken || cookieStore.get(REFRESH_COOKIE)?.value);
  // Only decidable when the access token itself is present — if only the
  // refresh cookie survives, the staff link/avatar name just don't show
  // until the next refresh; not worth a network round-trip to avoid that.
  const { role, name, email, membershipNumber } = accessToken ? peekJwtPayload(accessToken) : {};
  const isStaff = role === "agent" || role === "admin" || role === "subadmin";
  const t = await getTranslations("Nav");

  const theme: Theme = cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return (
    <header className="relative z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          {t("brand")}
        </Link>
        <nav className="ms-auto flex items-center gap-2">
          {isSignedIn ? (
            isStaff ? (
              <>
                <MobileStaffNav role={role} />
                <HeaderSearch role={role} />
                <NotificationBell />
                <ThemeToggleButton theme={theme} />
                <UserMenu name={name || "?"} email={email} membershipNumber={membershipNumber} locale={locale} inlineName />
              </>
            ) : (
              <>
                <ThemeToggleButton theme={theme} />
                <UserMenu name={name || "?"} email={email} membershipNumber={membershipNumber} locale={locale} />
              </>
            )
          ) : (
            <>
              <ThemeToggleButton theme={theme} />
              <LocaleToggleButton locale={locale} />
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t("logIn")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t("signUp")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
