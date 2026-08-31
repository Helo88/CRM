import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { peekJwtPayload } from "@/lib/jwt";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { StaffSidebar } from "@/components/StaffSidebar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ListPagination } from "@/components/ListPagination";
import { fetchNotificationHistory, type NotificationType } from "@/app/actions/notifications";
import { NotificationDateFilter } from "./NotificationDateFilter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotificationsPage");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const TYPE_KEY: Record<NotificationType, string> = {
  ticket_assigned: "notificationTicketAssigned",
  ticket_escalated: "notificationTicketEscalated",
  ticket_reassigned: "notificationTicketReassigned",
  ticket_unassigned: "notificationTicketUnassigned",
  ticket_created: "notificationTicketCreated",
  ticket_auto_assigned: "notificationTicketAutoAssigned",
  ticket_needs_assignment: "notificationTicketNeedsAssignment",
  ticket_reopened: "notificationTicketReopened",
  ticket_reopened_oversight: "notificationTicketReopenedOversight",
};

// The dedicated "view all" surface the notification bell's dropdown links
// to (NotificationBell.tsx caps itself at 10 + a "View all" link) — real
// pagination and a from/to date filter, neither of which belongs in a
// quick-glance header dropdown. Staff-only, same visibility as the bell
// itself (SiteHeader only renders it for agent/admin/subadmin); no
// permission gate beyond that — it's "my own data," same reasoning
// /me/notifications itself already uses.
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; from?: string; to?: string; _refreshed?: string }>;
}) {
  const { page: pageParam, from, to, _refreshed } = await searchParams;
  const t = await getTranslations("NotificationsPage");
  const tNav = await getTranslations("Nav");

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/notifications`);
    }
    redirect("/");
  }

  const { role } = peekJwtPayload(accessToken);
  const isStaffViewer = role === "agent" || role === "admin" || role === "subadmin";
  if (!isStaffViewer) {
    redirect("/dashboard");
  }

  const page = Math.max(1, Number(pageParam) || 1);
  const result = await fetchNotificationHistory({ page, from, to });

  const currentQuery = new URLSearchParams();
  if (from) currentQuery.set("from", from);
  if (to) currentQuery.set("to", to);

  function hrefForPage(nextPage: number) {
    const params = new URLSearchParams(currentQuery);
    params.set("page", String(nextPage));
    return `/notifications?${params.toString()}`;
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto w-full max-w-4xl">
          <h1 className="mb-6 text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>

          <NotificationDateFilter />

          {result.notifications.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 md:hidden">
                {result.notifications.map((item) => (
                  <Link
                    key={item.id}
                    href={`/tickets/${item.ticket.id}`}
                    className="block rounded-xl border border-border p-4 hover:bg-muted/50"
                  >
                    <span className={item.read ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
                      {tNav(TYPE_KEY[item.type])}
                    </span>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {item.ticket.reference} — {item.ticket.subject}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </Link>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columnType")}</TableHead>
                      <TableHead>{t("columnTicket")}</TableHead>
                      <TableHead>{t("columnDate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.notifications.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className={item.read ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
                          <Link href={`/tickets/${item.ticket.id}`} className="hover:underline">
                            {tNav(TYPE_KEY[item.type])}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Link href={`/tickets/${item.ticket.id}`} className="hover:underline">
                            {item.ticket.reference} — {item.ticket.subject}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <div className="mt-4">
            <ListPagination total={result.total} page={result.page} limit={result.limit} hrefForPage={hrefForPage} />
          </div>
        </div>
      </main>
    </div>
  );
}
