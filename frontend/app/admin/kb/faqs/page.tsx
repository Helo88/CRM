import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { StaffSidebar } from "@/components/StaffSidebar";
import { ListPagination } from "@/components/ListPagination";
import { Button } from "@/components/ui/button";
import { FaqFilterBar } from "./FaqFilterBar";
import { FaqAccordionList } from "./FaqAccordionList";
import { FaqDialog } from "./FaqDialog";
import type { FaqRecord } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminFaqs");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

interface FaqsListSearchParams {
  page?: string;
  q?: string;
  category?: string;
  sort?: string;
  _refreshed?: string;
}

// knowledge-base Story 29: admin FAQ list. Expandable rows (FaqAccordionList),
// not a table — the standard list-view pattern (server-driven pagination +
// filters + search) still applies, only the row rendering differs. Add/edit
// is FaqDialog, opened inline — there is no /admin/kb/faqs/new or
// /admin/kb/faqs/[id]/edit route.
export default async function AdminFaqsPage({ searchParams }: { searchParams: Promise<FaqsListSearchParams> }) {
  const { page: pageParam, q, category, sort, _refreshed } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const t = await getTranslations("AdminFaqs");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE) as Locale;

  const currentQuery = new URLSearchParams();
  if (q) currentQuery.set("q", q);
  if (category) currentQuery.set("category", category);
  if (sort) currentQuery.set("sort", sort);
  const nextUrl = `/admin/kb/faqs${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=${encodeURIComponent(nextUrl)}`);
    }
    redirect("/");
  }

  const listQuery = new URLSearchParams(currentQuery);
  listQuery.set("page", String(page));
  listQuery.set("limit", "10");

  const res = await fetch(`${API_URL}/api/v1/kb/faqs?${listQuery.toString()}`, {
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

  const data: { faqs: FaqRecord[]; total: number; page: number; limit: number } = await res.json();

  function hrefForPage(nextPage: number) {
    const params = new URLSearchParams(currentQuery);
    params.set("page", String(nextPage));
    return `/admin/kb/faqs?${params.toString()}`;
  }

  const { role: viewerRole, permissions: viewerPermissions = [] } = peekJwtPayload(token);
  const isViewerAdmin = viewerRole === "admin";
  const canCreate = isViewerAdmin || viewerPermissions.includes("kb:faq_create");
  const canEdit = isViewerAdmin || viewerPermissions.includes("kb:faq_edit");
  const canDelete = isViewerAdmin || viewerPermissions.includes("kb:faq_delete");

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="kbFaqs" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subheading")}</p>
          </div>
          {canCreate && (
            <FaqDialog mode="create" trigger={<Button size="sm">{t("addFaq")}</Button>} />
          )}
        </div>

        <FaqFilterBar />

        {data.faqs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <FaqAccordionList faqs={data.faqs} canEdit={canEdit} canDelete={canDelete} locale={locale} />
        )}

        <div className="mt-4">
          <ListPagination total={data.total} page={data.page} limit={data.limit} hrefForPage={hrefForPage} />
        </div>
      </main>
    </div>
  );
}
