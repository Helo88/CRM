import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Login");
  return { title: t("heading"), description: t("subheading") };
}

export default async function LoginPage() {
  const cookieStore = await cookies();
  // Either cookie counts as "already signed in" — the access cookie's short
  // maxAge means it's routinely absent for an otherwise-valid session (see
  // proxy.ts). /settings itself will silently refresh if only the refresh
  // cookie survives.
  if (cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(REFRESH_COOKIE)?.value) {
    redirect("/settings");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <LoginForm />
    </main>
  );
}
