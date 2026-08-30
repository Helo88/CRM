import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
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
// Both personas get HeaderSearch (⌘K) now — staff search over their nav
// pages plus quick-create actions (staffNav.ts), a customer searches over
// their own smaller set (customerSearch.ts). Staff additionally get
// notifications and the mobile nav drawer, which have no customer
// equivalent yet.
//
// Signed-in staff also get StaffSidebar's full-height rail (see that
// component), which sits to the left of this whole header rather than
// below it — so the header shrinks by a matching md:ms-20 instead of
// spanning edge-to-edge, leaving the rail uninterrupted top to bottom.
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
  const { id, role, name, email, membershipNumber, permissions = [] } = accessToken
    ? peekJwtPayload(accessToken)
    : {};
  const isStaff = role === "agent" || role === "admin" || role === "subadmin";
  const t = await getTranslations("Nav");

  const theme: Theme = cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return (
    <header
      className={cn(
        "relative z-40 border-b border-border bg-background",
        isSignedIn && isStaff && "md:ms-20"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className={cn("shrink-0 text-lg font-semibold", isSignedIn && isStaff && "hidden sm:block")}
        >
          {t("brand")}
        </Link>
        <nav className="ms-auto flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          {isSignedIn ? (
            isStaff ? (
              <>
                <MobileStaffNav role={role} permissions={permissions} />
                <HeaderSearch variant="staff" role={role} permissions={permissions} />
                <NotificationBell />
                <ThemeToggleButton theme={theme} />
                <UserMenu name={name || "?"} email={email} membershipNumber={membershipNumber} locale={locale} role={role} inlineName />
              </>
            ) : (
              <>
                <HeaderSearch variant="customer" />
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/tickets">{t("myTickets")}</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/support">{t("getSupport")}</Link>
                </Button>
                <ThemeToggleButton theme={theme} />
                <UserMenu
                  name={name || "?"}
                  email={email}
                  membershipNumber={membershipNumber}
                  locale={locale}
                  viewProfileHref={id ? `/customers/${id}` : undefined}
                />
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
