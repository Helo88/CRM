import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { StaffSidebar } from "@/components/StaffSidebar";
import { ListPagination } from "@/components/ListPagination";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ArticleFilterBar } from "./ArticleFilterBar";
import { ArticleDialog } from "./ArticleDialog";
import { RowActions } from "./RowActions";
import type { ArticleListItem } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminArticles");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

interface ArticlesListSearchParams {
  page?: string;
  q?: string;
  category?: string;
  sort?: string;
  _refreshed?: string;
}

// knowledge-base Story 30: admin help-article list. A plain table — title
// and category only, no body preview (a 50KB Markdown document has nothing
// useful to show at list density; the edit dialog fetches the full body).
// Add/edit is ArticleDialog, opened inline — no /admin/kb/articles/new or
// [id]/edit route.
export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<ArticlesListSearchParams> }) {
  const { page: pageParam, q, category, sort, _refreshed } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const t = await getTranslations("AdminArticles");
  const tCat = await getTranslations("KbCategories");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  const currentQuery = new URLSearchParams();
  if (q) currentQuery.set("q", q);
  if (category) currentQuery.set("category", category);
  if (sort) currentQuery.set("sort", sort);
  const nextUrl = `/admin/kb/articles${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=${encodeURIComponent(nextUrl)}`);
    }
    redirect("/");
  }

  const listQuery = new URLSearchParams(currentQuery);
  listQuery.set("page", String(page));
  listQuery.set("limit", "10");

  const res = await fetch(`${API_URL}/api/v1/kb/articles?${listQuery.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    if (!_refreshed) {
      redirect(`/api/session/refresh?next=${encodeURIComponent(nextUrl)}`);
    }
    redirect("/login");
  }

  if (res.status === 403) {
    redirect("/dashboard");
  }

  if (!res.ok) {
    redirect("/");
  }

  const data: { articles: ArticleListItem[]; total: number; page: number; limit: number } = await res.json();

  function hrefForPage(nextPage: number) {
    const params = new URLSearchParams(currentQuery);
    params.set("page", String(nextPage));
    return `/admin/kb/articles?${params.toString()}`;
  }

  const { role: viewerRole, permissions: viewerPermissions = [] } = peekJwtPayload(token);
  const isViewerAdmin = viewerRole === "admin";
  const canCreate = isViewerAdmin || viewerPermissions.includes("kb:article_create");
  const canEdit = isViewerAdmin || viewerPermissions.includes("kb:article_edit");
  const canDelete = isViewerAdmin || viewerPermissions.includes("kb:article_delete");
  const showActionsColumn = canEdit || canDelete;

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="kbArticles" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subheading")}</p>
          </div>
          {canCreate && <ArticleDialog mode="create" trigger={<Button size="sm">{t("addArticle")}</Button>} />}
        </div>

        <ArticleFilterBar />

        {data.articles.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            {/* Mobile (< md): stacked cards. */}
            <div className="flex flex-col gap-3 md:hidden">
              {data.articles.map((a) => (
                <div key={a.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.title.en || a.title.ar}</div>
                      {a.title.ar && a.title.en && (
                        <div className="truncate text-sm text-muted-foreground" dir="rtl" lang="ar">
                          {a.title.ar}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-icon-category/15 px-2.5 py-1 text-xs font-semibold text-icon-category">
                      {tCat(a.category)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">{new Date(a.updatedAt).toLocaleDateString()}</span>
                    {showActionsColumn && <RowActions article={a} canEdit={canEdit} canDelete={canDelete} />}
                  </div>
                </div>
              ))}
            </div>

            {/* md and up: the real table. */}
            <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colTitle")}</TableHead>
                    <TableHead>{t("colCategory")}</TableHead>
                    <TableHead>{t("colUpdated")}</TableHead>
                    {showActionsColumn && <TableHead className="text-end">{t("colActions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.articles.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.title.en || a.title.ar}</div>
                        {a.title.ar && a.title.en && (
                          <div className="text-xs text-muted-foreground" dir="rtl" lang="ar">
                            {a.title.ar}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-icon-category/15 px-2.5 py-1 text-xs font-semibold text-icon-category">
                          {tCat(a.category)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(a.updatedAt).toLocaleDateString()}
                      </TableCell>
                      {showActionsColumn && (
                        <TableCell>
                          <RowActions article={a} canEdit={canEdit} canDelete={canDelete} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <div className="mt-4">
          <ListPagination total={data.total} page={data.page} limit={data.limit} hrefForPage={hrefForPage} />
        </div>
      </main>
    </div>
  );
}
