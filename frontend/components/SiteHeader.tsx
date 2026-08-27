import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { LOCALE_COOKIE, DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";

// Present on every page (rendered from RootLayout) so there's always a way
// back home and, for a signed-in user, a way to reach their profile,
// switch theme/language, or sign out without navigating to "/" first.
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
  const { role, name } = accessToken ? peekJwtPayload(accessToken) : {};
  const isStaff = role === "agent" || role === "admin";
  const t = await getTranslations("Nav");

  const theme: Theme = cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-2">
          {isSignedIn ? (
            <>
              {isStaff && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/customers">{t("customers")}</Link>
                </Button>
              )}
              <UserMenu name={name || "?"} theme={theme} locale={locale} />
            </>
          ) : (
            <>
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
