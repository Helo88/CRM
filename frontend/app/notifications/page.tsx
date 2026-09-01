import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  UserCheck,
  ArrowUpCircle,
  Repeat,
  UserMinus,
  TicketPlus,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { peekJwtPayload } from "@/lib/jwt";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { cn, formatDateTime } from "@/lib/utils";
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

// Icon + semantic color per notification type — reused meanings, not new
// colors: escalated stays destructive (same red the ticket's own "Escalated"
// badge uses elsewhere), anything needing attention (unassigned work,
// reopened) is warning, routine assignment/creation is primary, and the one
// purely-informational type (lost your assignment) is muted. Icons echo the
// ones already used for the same action elsewhere (ArrowUpCircle for
// escalate, Repeat for reassign, TicketPlus for a new ticket).
const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  ticket_assigned: UserCheck,
  ticket_escalated: ArrowUpCircle,
  ticket_reassigned: Repeat,
  ticket_unassigned: UserMinus,
  ticket_created: TicketPlus,
  ticket_auto_assigned: Sparkles,
  ticket_needs_assignment: AlertTriangle,
  ticket_reopened: RotateCcw,
  ticket_reopened_oversight: RotateCcw,
};

const TYPE_COLOR_CLASS: Record<NotificationType, string> = {
  ticket_assigned: "bg-primary/10 text-primary",
  ticket_escalated: "bg-destructive/10 text-destructive",
  ticket_reassigned: "bg-primary/10 text-primary",
  ticket_unassigned: "bg-muted text-muted-foreground",
  ticket_created: "bg-primary/10 text-primary",
  ticket_auto_assigned: "bg-primary/10 text-primary",
  ticket_needs_assignment: "bg-warning/10 text-warning",
  ticket_reopened: "bg-warning/10 text-warning",
  ticket_reopened_oversight: "bg-warning/10 text-warning",
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
                {result.notifications.map((item) => {
                  const Icon = TYPE_ICON[item.type];
                  return (
                    <Link
                      key={item.id}
                      href={`/tickets/${item.ticket.id}`}
                      className={cn(
                        "flex gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50",
                        item.read ? "border-border" : "border-primary/30 bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          TYPE_COLOR_CLASS[item.type]
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={item.read ? "text-sm text-muted-foreground" : "text-sm font-semibold"}>
                          {tNav(TYPE_KEY[item.type])}
                        </span>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {item.ticket.reference} — {item.ticket.subject}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                      </div>
                      {!item.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                    </Link>
                  );
                })}
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
                    {result.notifications.map((item) => {
                      const Icon = TYPE_ICON[item.type];
                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            !item.read && "border-s-2 border-s-primary bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                          <TableCell>
                            <Link href={`/tickets/${item.ticket.id}`} className="flex items-center gap-2.5 hover:underline">
                              <span
                                className={cn(
                                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                                  TYPE_COLOR_CLASS[item.type]
                                )}
                              >
                                <Icon className="size-3.5" />
                              </span>
                              <span className={item.read ? "text-sm text-muted-foreground" : "text-sm font-semibold"}>
                                {tNav(TYPE_KEY[item.type])}
                              </span>
                              {!item.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
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
                      );
                    })}
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
