import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { StaffSidebar } from "@/components/StaffSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RowActions } from "./RowActions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminTicketCategories");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

interface TicketCategoryRow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

// Admin/sub-admin-only ticket category list (Story 58), gated on
// tickets:manage_categories. No pagination — categories are expected to
// stay a short, hand-curated list, unlike the customer/staff rosters.
export default async function AdminTicketCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const t = await getTranslations("AdminTicketCategories");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/admin/ticket-categories");
    }
    redirect("/");
  }

  const res = await fetch(`${API_URL}/api/v1/ticket-categories`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    if (!_refreshed) {
      redirect("/api/session/refresh?next=/admin/ticket-categories");
    }
    redirect("/login");
  }

  // GET / is requireAuth-only on the backend (any authenticated role can
  // read the list) — 403 isn't actually reachable here, but the redirect
  // stays for symmetry with every other admin page, in case that gate
  // tightens later.
  if (res.status === 403) {
    redirect("/dashboard");
  }

  if (!res.ok) {
    redirect("/");
  }

  const categories: TicketCategoryRow[] = await res.json();

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>
          <Button asChild size="sm">
            <Link href="/admin/ticket-categories/new">{t("addCategory")}</Link>
          </Button>
        </div>

        {categories.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            {/* Mobile (< md): stacked cards — same reasoning as the staff roster. */}
            <div className="flex flex-col gap-3 md:hidden">
              {categories.map((c) => (
                <div key={c.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.active ? (
                      <Badge variant="outline" className="shrink-0 border-transparent bg-success/10 text-success">
                        {t("statusActive")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        {t("statusInactive")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <RowActions categoryId={c.id} name={c.name} active={c.active} />
                  </div>
                </div>
              ))}
            </div>

            {/* md and up: the real table. */}
            <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colName")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colCreated")}</TableHead>
                    <TableHead className="text-end">{t("colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        {c.active ? (
                          <Badge variant="outline" className="border-success/30 text-success">
                            {t("statusActive")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t("statusInactive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <RowActions categoryId={c.id} name={c.name} active={c.active} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
