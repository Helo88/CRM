import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { pickLocalized } from "@/lib/localized";
import { KB_CATEGORY_SLUGS, type KbCategorySlug } from "@/lib/kb";
import { fetchPublicFaqs, fetchPublicArticles } from "@/lib/kbPublic";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ListPagination } from "@/components/ListPagination";
import { KbFaqAccordion } from "./KbFaqAccordion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HelpCenter");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    // Deliberately NO robots: { index:false } — this is one of the few
    // pages in this app that SHOULD be crawled (CLAUDE.md's SEO section).
  };
}

type HelpTab = "faqs" | "articles";

interface HelpSearchParams {
  tab?: string;
  category?: string;
  faqPage?: string;
  articlePage?: string;
}

// knowledge-base Story 31: the public, unauthenticated Help Center. FAQs
// and articles live behind a tab switch (not stacked on one scroll) — the
// direction chosen when reviewing this page's design concepts. Plain
// server-rendered <Link>s for both the tab switch and the category filter,
// not client state: this page must work with no JavaScript, be crawlable,
// and give every combination a real, shareable, indexable URL.
export default async function HelpCenterPage({ searchParams }: { searchParams: Promise<HelpSearchParams> }) {
  const { tab: tabParam, category: categoryParam, faqPage: faqPageParam, articlePage: articlePageParam } =
    await searchParams;
  const t = await getTranslations("HelpCenter");
  const tCat = await getTranslations("KbCategories");

  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE) as Locale;

  const tab: HelpTab = tabParam === "articles" ? "articles" : "faqs";
  const category =
    categoryParam && (KB_CATEGORY_SLUGS as readonly string[]).includes(categoryParam)
      ? (categoryParam as KbCategorySlug)
      : undefined;
  const faqPage = Math.max(1, Number(faqPageParam) || 1);
  const articlePage = Math.max(1, Number(articlePageParam) || 1);

  const [faqsResult, articlesResult] =
    tab === "faqs"
      ? [await fetchPublicFaqs({ category, page: faqPage, limit: 10 }), { items: [], total: 0, page: 1, limit: 10 }]
      : [{ items: [], total: 0, page: 1, limit: 10 }, await fetchPublicArticles({ category, page: articlePage, limit: 10 })];

  function hrefFor(next: Partial<{ tab: HelpTab; category: string | undefined; faqPage: number; articlePage: number }>) {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextCategory = "category" in next ? next.category : category;
    if (nextTab !== "faqs") params.set("tab", nextTab);
    if (nextCategory) params.set("category", nextCategory);
    if (next.faqPage && next.faqPage > 1) params.set("faqPage", String(next.faqPage));
    if (next.articlePage && next.articlePage > 1) params.set("articlePage", String(next.articlePage));
    const qs = params.toString();
    return `/help${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("heading")}</h1>
          <p className="mt-2 text-muted-foreground">{t("intro")}</p>
        </div>

        <div className="mt-8 flex justify-center gap-6 border-b border-border">
          <Link
            href={hrefFor({ tab: "faqs" })}
            aria-current={tab === "faqs" ? "page" : undefined}
            className={cn(
              "border-b-2 pb-3 text-sm font-semibold",
              tab === "faqs" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            {t("faqsTab")}
          </Link>
          <Link
            href={hrefFor({ tab: "articles" })}
            aria-current={tab === "articles" ? "page" : undefined}
            className={cn(
              "border-b-2 pb-3 text-sm font-semibold",
              tab === "articles" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            {t("articlesTab")}
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href={hrefFor({ category: undefined })}
            aria-current={!category ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              !category ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            )}
          >
            {t("filterAll")}
          </Link>
          {KB_CATEGORY_SLUGS.map((slug) => (
            <Link
              key={slug}
              href={hrefFor({ category: slug })}
              aria-current={category === slug ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                category === slug ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}
            >
              {tCat(slug)}
            </Link>
          ))}
        </div>

        <div className="mt-8">
          {tab === "faqs" ? (
            faqsResult.items.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">{t("faqsEmpty")}</p>
            ) : (
              <>
                <KbFaqAccordion faqs={faqsResult.items} locale={locale} />
                <div className="mt-6">
                  <ListPagination
                    total={faqsResult.total}
                    page={faqsResult.page}
                    limit={faqsResult.limit}
                    hrefForPage={(p) => hrefFor({ faqPage: p })}
                  />
                </div>
              </>
            )
          ) : articlesResult.items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{t("articlesEmpty")}</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {articlesResult.items.map((article) => {
                  const title = pickLocalized(article.title, locale);
                  const summary = pickLocalized(article.summary, locale);
                  return (
                    <Link key={article.id} href={`/help/${article.slug}`}>
                      <Card hover className="h-full">
                        <CardHeader>
                          <CardTitle>
                            <h3 lang={title.language} dir={title.language === "ar" ? "rtl" : "ltr"}>
                              {title.value}
                            </h3>
                          </CardTitle>
                          <CardDescription
                            className="line-clamp-2"
                            lang={summary.language}
                            dir={summary.language === "ar" ? "rtl" : "ltr"}
                          >
                            {summary.value}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="rounded-full bg-icon-category/15 px-2.5 py-1 font-semibold text-icon-category">
                            {tCat(article.category)}
                          </span>
                          <span>{t("lastUpdated", { date: new Date(article.updatedAt).toLocaleDateString(locale) })}</span>
                        </CardFooter>
                      </Card>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-6">
                <ListPagination
                  total={articlesResult.total}
                  page={articlesResult.page}
                  limit={articlesResult.limit}
                  hrefForPage={(p) => hrefFor({ articlePage: p })}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-12 text-center">
          <Link href="/support" className="text-sm font-medium text-primary hover:underline">
            {t("backToSupport")}
          </Link>
        </div>
      </main>
    </div>
  );
}
