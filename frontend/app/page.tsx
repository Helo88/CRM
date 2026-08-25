import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./LogoutButton";

export default async function Home() {
  const cookieStore = await cookies();
  const isSignedIn = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
  const t = await getTranslations("Home");

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("tagline")}</p>
        {isSignedIn ? (
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/settings">{t("goToSettings")}</Link>
            </Button>
            <LogoutButton />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/login">{t("logIn")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">{t("signUp")}</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
