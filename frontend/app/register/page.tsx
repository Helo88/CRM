import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { AuthHero } from "@/components/AuthHero";
import { RegisterForm } from "./RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Register");
  const tHero = await getTranslations("AuthHero");
  return { title: t("heading"), description: tHero("subheading") };
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
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-4 md:p-8">
      <div className="relative w-full max-w-5xl">
        <AuthHero />
        <div className="z-10 mt-6 w-full rounded-3xl border border-border bg-card p-8 shadow-pop ring-1 ring-foreground/10 md:absolute md:end-8 md:top-1/2 md:mt-0 md:w-[380px] md:-translate-y-1/2 md:p-9 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:100ms] [animation-fill-mode:both]">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
