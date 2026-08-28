import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="animate-in fade-in slide-in-from-top-2 text-7xl font-extrabold tracking-tight text-primary duration-500">
          404
        </p>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-delay:150ms] [animation-fill-mode:both] space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{t("heading")}</h1>
          <p className="text-muted-foreground text-balance">{t("description")}</p>
        </div>
        <Button asChild className="mt-3">
          <Link href="/">
            <Home className="size-4" />
            {t("backHome")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
