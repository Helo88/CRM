import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { StaffSidebar } from "@/components/StaffSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CustomersList");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  membershipNumber: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

// Staff-only roster (agent/admin) — see backend/src/routes/customer.routes.ts's
// GET / for why this exists outside the original story backlog. One row per
// customer; this is deliberately NOT where per-ticket detail lives — that's
// a separate, ticket-management-owned table/list later (one row per ticket,
// customer name linking back to /customers/[id]), not merged into this one.
export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; _refreshed?: string }>;
}) {
  const { page: pageParam, _refreshed } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const t = await getTranslations("CustomersList");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/customers${page > 1 ? `?page=${page}` : ""}`);
    }
    redirect("/");
  }

  const res = await fetch(`${API_URL}/api/v1/customers?page=${page}&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    if (!_refreshed) {
      redirect(`/api/session/refresh?next=/customers${page > 1 ? `?page=${page}` : ""}`);
    }
    redirect("/login");
  }

  if (res.status === 403) {
    // A persona without customers:manage never gets a working link to this
    // page (see lib/staffNav.ts), so reaching it and being turned away
    // belongs on the dashboard, not a dead-end message here.
    redirect("/dashboard");
  }

  if (!res.ok) {
    redirect("/");
  }

  const data: { customers: CustomerRow[]; total: number; page: number; limit: number } =
    await res.json();
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  // Mirrors backend/src/routes/customer.routes.ts's GET /:id gate exactly —
  // agent/admin always, a sub-admin only with the same customers:manage
  // delegation the roster itself required to load. A name/history link a
  // click would just 403 on isn't a link — render as plain text instead.
  const { role: viewerRole, permissions: viewerPermissions = [] } = peekJwtPayload(token);
  const canViewCustomerDetail =
    viewerRole === "agent" || viewerRole === "admin" || viewerPermissions.includes("customers:manage");

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="customers" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>
          <Button asChild size="sm">
            <Link href="/customers/new">{t("addCustomer")}</Link>
          </Button>
        </div>

        {data.customers.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            {/* Mobile (< md): stacked cards — a wide table forced into a
                narrow viewport either overflows the page or becomes an
                unreadable horizontal-scroll strip; a table just isn't the
                right shape for this data below a certain width. */}
            <div className="flex flex-col gap-3 md:hidden">
              {data.customers.map((c) => (
                <div key={c.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    {canViewCustomerDetail ? (
                      <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                    {c.isActive ? (
                      <Badge variant="outline" className="shrink-0 border-transparent bg-success/10 text-success">
                        {t("statusActive")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        {t("statusInactive")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{c.email}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{c.membershipNumber}</p>
                  <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{c.phone ?? "—"}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  {canViewCustomerDetail && (
                    <Link
                      href={`/api/v1/customers/${c.id}/history`}
                      className="mt-3 inline-block text-sm text-primary hover:underline"
                    >
                      {t("history")}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* md and up: the real table. */}
            <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colName")}</TableHead>
                    <TableHead>{t("colMembershipNumber")}</TableHead>
                    <TableHead>{t("colEmail")}</TableHead>
                    <TableHead>{t("colPhone")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colJoined")}</TableHead>
                    <TableHead>{t("colHistory")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {canViewCustomerDetail ? (
                          <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{c.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{c.membershipNumber}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.phone ?? "—"}</TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <Badge variant="outline" className="border-transparent bg-success/10 text-success">
                            {t("statusActive")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t("statusInactive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {canViewCustomerDetail && (
                          <Link
                            href={`/api/v1/customers/${c.id}/history`}
                            className="text-sm text-primary hover:underline"
                          >
                            {t("history")}
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/customers?page=${page - 1}`}>{t("previous")}</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                {t("previous")}
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {t("pageOf", { page, totalPages })}
            </span>
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/customers?page=${page + 1}`}>{t("next")}</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                {t("next")}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
