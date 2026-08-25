import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/app/LogoutButton";

// Present on every page (rendered from RootLayout) so there's always a way
// back home and, for a signed-in user, a way to reach Settings or sign out
// without navigating to "/" first.
export async function SiteHeader() {
  const cookieStore = await cookies();
  const isSignedIn = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
  const t = await getTranslations("Nav");

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-2">
          {isSignedIn ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings">{t("settings")}</Link>
              </Button>
              <LogoutButton />
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
