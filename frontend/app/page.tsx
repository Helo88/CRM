import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("Home");

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-8">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("tagline")}</p>
      </div>
    </main>
  );
}
