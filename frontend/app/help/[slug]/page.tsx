import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { pickLocalized } from "@/lib/localized";
import { fetchPublicArticle } from "@/lib/kbPublic";
import { ArticleBody } from "@/components/ArticleBody";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchPublicArticle(slug);
  if (!article) {
    const t = await getTranslations("HelpArticlePage");
    return { title: t("meta.notFoundTitle") };
  }
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE) as Locale;
  return {
    title: pickLocalized(article.title, locale).value,
    description: pickLocalized(article.summary, locale).value,
    // Deliberately NO robots: { index:false } — public, indexable article.
  };
}

// knowledge-base Story 31: the only content detail page this story adds.
// FAQs stay inline on /help (an Accordion, no navigation cost); an article
// is long-form enough to deserve its own URL, <h1>, and metadata.
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await fetchPublicArticle(slug);
  if (!article) notFound();

  const t = await getTranslations("HelpArticlePage");
  const tCat = await getTranslations("KbCategories");
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE) as Locale;

  const title = pickLocalized(article.title, locale);
  const summary = pickLocalized(article.summary, locale);
  const body = pickLocalized(article.body, locale);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <Link href="/help" className="text-sm font-medium text-primary hover:underline">
          {t("backToHelp")}
        </Link>

        <h1
          className="mt-4 text-2xl font-bold tracking-tight md:text-3xl"
          lang={title.language}
          dir={title.language === "ar" ? "rtl" : "ltr"}
        >
          {title.value}
        </h1>

        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="rounded-full bg-icon-category/15 px-2.5 py-1 text-xs font-semibold text-icon-category">
            {tCat(article.category)}
          </span>
          <span>{t("lastUpdated", { date: new Date(article.updatedAt).toLocaleDateString(locale) })}</span>
        </div>

        {summary.value && (
          <p
            className="mt-4 text-muted-foreground"
            lang={summary.language}
            dir={summary.language === "ar" ? "rtl" : "ltr"}
          >
            {summary.value}
          </p>
        )}

        <div className="mt-8">
          <ArticleBody markdown={body.value} lang={body.language} />
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center">
          <Link href="/support" className="text-sm font-medium text-primary hover:underline">
            {t("stillNeedHelp")}
          </Link>
        </div>
      </main>
    </div>
  );
}
