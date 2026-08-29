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
import { RowActions } from "./RowActions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminUsersList");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

interface StaffAccountRow {
  id: string;
  name: string;
  email: string;
  membershipNumber: string;
  role: "agent" | "admin" | "subadmin";
  isActive: boolean;
  isOnline: boolean;
  createdAt: string;
}

// Admin-only roster (Story 45, security-admin) — agent/admin/sub-admin
// accounts. "admin" rows appear here for visibility even though they can
// never be created through this router (see backend/src/routes/admin.routes.ts).
export default async function AdminUsersListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; _refreshed?: string }>;
}) {
  const { page: pageParam, _refreshed } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const t = await getTranslations("AdminUsersList");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/admin/users${page > 1 ? `?page=${page}` : ""}`);
    }
    redirect("/");
  }

  const res = await fetch(`${API_URL}/api/v1/admin/users?page=${page}&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    if (!_refreshed) {
      redirect(`/api/session/refresh?next=/admin/users${page > 1 ? `?page=${page}` : ""}`);
    }
    redirect("/login");
  }

  if (res.status === 403) {
    // A staff persona without staff:view_list at all never gets a working
    // link to this page (see lib/staffNav.ts), so reaching it and being
    // turned away belongs on the dashboard, not a dead-end message here.
    redirect("/dashboard");
  }

  if (!res.ok) {
    redirect("/");
  }

  const data: { users: StaffAccountRow[]; total: number; page: number; limit: number } =
    await res.json();
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  const { role: viewerRole, permissions: viewerPermissions = [] } = peekJwtPayload(token);
  const isViewerAdmin = viewerRole === "admin";
  const canEdit = isViewerAdmin || viewerPermissions.includes("staff:edit");
  const canToggleStatus = isViewerAdmin || viewerPermissions.includes("staff:toggle_status");
  const canDelete = isViewerAdmin || viewerPermissions.includes("staff:delete");
  const showActionsColumn = canEdit || canToggleStatus || canDelete;

  const roleLabel = (role: StaffAccountRow["role"]) =>
    role === "agent" ? t("roleAgent") : role === "admin" ? t("roleAdmin") : t("roleSubadmin");

  const onlineLabel = (row: StaffAccountRow) =>
    row.role !== "agent" ? t("onlineNotApplicable") : row.isOnline ? t("onlineYes") : t("onlineNo");

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="accounts" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>
          <Button asChild size="sm">
            <Link href="/admin/users/new">{t("addAccount")}</Link>
          </Button>
        </div>

        {data.users.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            {/* Mobile (< md): stacked cards — same reasoning as the customer roster. */}
            <div className="flex flex-col gap-3 md:hidden">
              {data.users.map((u) => (
                <div key={u.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{u.name}</span>
                    {u.isActive ? (
                      <Badge variant="outline" className="shrink-0 border-transparent bg-success/10 text-success">
                        {t("statusActive")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        {t("statusInactive")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{u.email}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{u.membershipNumber}</p>
                  <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{roleLabel(u.role)}</span>
                    <span>{onlineLabel(u)}</span>
                  </div>
                  {showActionsColumn && (
                    <div className="mt-3 flex justify-end border-t border-border pt-3">
                      <RowActions
                        userId={u.id}
                        role={u.role}
                        isActive={u.isActive}
                        canEdit={canEdit}
                        canToggleStatus={canToggleStatus}
                        canDelete={canDelete}
                      />
                    </div>
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
                    <TableHead>{t("colRole")}</TableHead>
                    <TableHead>{t("colOnline")}</TableHead>
                    <TableHead>{t("colJoined")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    {showActionsColumn && <TableHead className="text-end">{t("colActions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{u.membershipNumber}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{roleLabel(u.role)}</TableCell>
                      <TableCell>{onlineLabel(u)}</TableCell>
                      <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="outline" className="border-success/30 text-success">
                            {t("statusActive")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t("statusInactive")}</Badge>
                        )}
                      </TableCell>
                      {showActionsColumn && (
                        <TableCell>
                          <RowActions
                            userId={u.id}
                            role={u.role}
                            isActive={u.isActive}
                            canEdit={canEdit}
                            canToggleStatus={canToggleStatus}
                            canDelete={canDelete}
                          />
                        </TableCell>
                      )}
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
                <Link href={`/admin/users?page=${page - 1}`}>{t("previous")}</Link>
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
                <Link href={`/admin/users?page=${page + 1}`}>{t("next")}</Link>
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
