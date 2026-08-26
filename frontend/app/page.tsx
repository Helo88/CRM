import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PresenceBadge } from "@/components/PresenceBadge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return { title: { absolute: t("title") }, description: t("tagline") };
}

export default async function Home() {
  const t = await getTranslations("Home");
  const tAuth = await getTranslations("Auth");

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          <PresenceBadge label={tAuth("supportOnline")} />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-delay:150ms] [animation-fill-mode:both] space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-balance">{t("tagline")}</p>
        </div>
      </div>
    </main>
  );
}
