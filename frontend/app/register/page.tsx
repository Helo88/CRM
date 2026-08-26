import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Register");
  return { title: t("heading"), description: t("subheading") };
}

// Server Component: redirects an already-signed-in visitor away, same guard
// pattern as login/page.tsx (including the either-cookie check — see that
// file's comment).
export default async function RegisterPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(REFRESH_COOKIE)?.value) {
    redirect("/settings");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <RegisterForm />
    </main>
  );
}
