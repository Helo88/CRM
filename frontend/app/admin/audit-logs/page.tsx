import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format, isToday, isYesterday } from "date-fns";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { StaffSidebar } from "@/components/StaffSidebar";
import { ListPagination } from "@/components/ListPagination";
import { cn } from "@/lib/utils";
import { AuditLogFilterBar } from "./AuditLogFilterBar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AuditLogList");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

type AuditAction =
  | "login_success"
  | "login_failed"
  | "permissions_changed"
  | "staff_activated"
  | "staff_deactivated";
type AuditCategory = "auth" | "permissions" | "staff";

interface AuditActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuditLogEntry {
  id: string;
  actor: AuditActor | null;
  action: AuditAction;
  category: AuditCategory;
  targetType: "User";
  targetId: string | null;
  target: AuditActor | null;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// security-admin Story 47: admin/subadmin-facing read-only audit timeline,
// gated on audit:view. Grouped-by-day rendering (chosen UI Option B) — the
// backend already returns entries newest-first, this groups the current
// page's rows by local calendar date under Today/Yesterday/explicit-date
// headers. A day can split across a page boundary; accepted the same way
// no other list view in the app respects logical groupings across pages.
const CATEGORY_ACCENT: Record<AuditCategory, string> = {
  auth: "bg-icon-status",
  permissions: "bg-icon-priority",
  staff: "bg-icon-category",
};

interface AuditLogListSearchParams {
  page?: string;
  q?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  _refreshed?: string;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<AuditLogListSearchParams>;
}) {
  const { page: pageParam, q, category, dateFrom, dateTo, _refreshed } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const t = await getTranslations("AuditLogList");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  const currentQuery = new URLSearchParams();
  if (q) currentQuery.set("q", q);
  if (category) currentQuery.set("category", category);
  if (dateFrom) currentQuery.set("dateFrom", dateFrom);
  if (dateTo) currentQuery.set("dateTo", dateTo);
  const nextUrl = `/admin/audit-logs${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=${encodeURIComponent(nextUrl)}`);
    }
    redirect("/");
  }

  const listQuery = new URLSearchParams(currentQuery);
  listQuery.set("page", String(page));
  // Denser than a 10-row table — a compact timeline reads well with more
  // entries per page.
  listQuery.set("limit", "20");

  const res = await fetch(`${API_URL}/api/v1/admin/audit-logs?${listQuery.toString()}`, {
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
    // A staff persona without audit:view never gets a working nav link to
    // this page (see lib/staffNav.ts), so reaching it and being turned away
    // belongs on the dashboard, not a dead-end message here — same
    // reasoning as admin/users/page.tsx.
    redirect("/dashboard");
  }

  if (!res.ok) {
    redirect("/");
  }

  const data: { entries: AuditLogEntry[]; total: number; page: number; limit: number } = await res.json();

  function hrefForPage(nextPage: number) {
    const params = new URLSearchParams(currentQuery);
    params.set("page", String(nextPage));
    return `/admin/audit-logs?${params.toString()}`;
  }

  function actorLabel(entry: AuditLogEntry): string {
    if (entry.actor) return entry.actor.name;
    const email = typeof entry.metadata.attemptedEmail === "string" ? entry.metadata.attemptedEmail : "—";
    return t("unknownActor", { email });
  }

  function targetLabel(entry: AuditLogEntry): string {
    return entry.target?.name ?? entry.target?.email ?? "—";
  }

  function actionLine(entry: AuditLogEntry): string {
    const actor = actorLabel(entry);
    const target = targetLabel(entry);
    switch (entry.action) {
      case "login_success":
        return t("actionLoginSuccess", { actor });
      case "login_failed": {
        const reason = entry.metadata.reason;
        if (reason === "unknown_email") {
          const email = typeof entry.metadata.attemptedEmail === "string" ? entry.metadata.attemptedEmail : "—";
          return t("actionLoginFailedUnknownEmail", { email });
        }
        if (reason === "account_deactivated") return t("actionLoginFailedAccountDeactivated", { actor });
        return t("actionLoginFailedWrongPassword", { actor });
      }
      case "permissions_changed":
        return t("actionPermissionsChanged", { actor, target });
      case "staff_activated":
        return t("actionStaffActivated", { actor, target });
      case "staff_deactivated":
        return t("actionStaffDeactivated", { actor, target });
      default:
        return entry.action;
    }
  }

  function dayHeaderLabel(date: Date): string {
    if (isToday(date)) return t("today");
    if (isYesterday(date)) return t("yesterday");
    return format(date, "MMMM d, yyyy");
  }

  // Group the current page's entries (already newest-first) by local
  // calendar date, preserving order within each group.
  const groups: { key: string; date: Date; entries: AuditLogEntry[] }[] = [];
  for (const entry of data.entries) {
    const date = new Date(entry.createdAt);
    const key = format(date, "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, date, entries: [entry] });
    }
  }

  const hasActiveFilter = Boolean(q || category || dateFrom || dateTo);

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="auditLog" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>
        </div>

        <AuditLogFilterBar />

        {data.entries.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{hasActiveFilter ? t("noResults") : t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.key} className="flex gap-4">
                {/* Left rail: date header, per the chosen "grouped-by-day
                    timeline" UI direction. */}
                <div className="w-20 shrink-0 pt-1 text-end sm:w-28">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {dayHeaderLabel(group.date)}
                  </span>
                </div>
                <div className="min-w-0 flex-1 border-s border-border ps-4">
                  <div className="flex flex-col gap-3">
                    {group.entries.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3">
                        <span
                          className={cn("mt-1.5 size-2 shrink-0 rounded-full", CATEGORY_ACCENT[entry.category])}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{actionLine(entry)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{format(new Date(entry.createdAt), "p")}</span>
                            {entry.actor?.email && <span>{entry.actor.email}</span>}
                            {entry.ipAddress && <span>{t("ipAddressLabel", { ip: entry.ipAddress })}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <ListPagination total={data.total} page={data.page} limit={data.limit} hrefForPage={hrefForPage} />
        </div>
      </main>
    </div>
  );
}
