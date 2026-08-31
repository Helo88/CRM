import { StaffSidebar } from "@/components/StaffSidebar";
import { API_URL, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerTicketList, type CustomerTicketRow } from "./CustomerTicketList";
import { StaffTicketQueue, type StaffTicketRow } from "./StaffTicketQueue";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Tickets");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

interface TicketListSearchParams {
  page?: string;
  status?: string;
  category?: string;
  priority?: string;
  sort?: string;
  _refreshed?: string;
}

// Story 60 (merged with customer-portal Story 36 "track ticket status from
// the portal" and platform Story 59 "paginate list views" — see that story's
// intake for why these ship together): one route, role-branched — a
// customer sees their own tickets (CustomerTicketList), staff see the
// filterable/sortable/permission-gated queue (StaffTicketQueue). Same
// pattern already used by /tickets/[id] and /customers.
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<TicketListSearchParams>;
}) {
  const { page: pageParam, status, category, priority, sort, _refreshed } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  const currentQuery = new URLSearchParams();
  if (status) currentQuery.set("status", status);
  if (category) currentQuery.set("category", category);
  if (priority) currentQuery.set("priority", priority);
  if (sort) currentQuery.set("sort", sort);
  const nextUrl = `/tickets${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=${encodeURIComponent(nextUrl)}`);
    }
    redirect("/");
  }

  const { id: viewerId, role: viewerRole, permissions: viewerPermissions = [] } = peekJwtPayload(token);
  const isStaff = viewerRole === "agent" || viewerRole === "admin" || viewerRole === "subadmin";

  const listQuery = new URLSearchParams(currentQuery);
  listQuery.set("page", String(page));
  listQuery.set("limit", "10");

  const fetches: [Promise<Response>, Promise<Response>?] = [
    fetch(`${API_URL}/api/v1/tickets?${listQuery.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  ];
  if (isStaff) {
    fetches.push(
      fetch(`${API_URL}/api/v1/ticket-categories?active=true`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
    );
  }
  const [res, categoriesRes] = await Promise.all(fetches);

  if (res.status === 401) {
    if (!_refreshed) {
      redirect(`/api/session/refresh?next=${encodeURIComponent(nextUrl)}`);
    }
    redirect("/login");
  }

  if (!res.ok) {
    redirect("/dashboard");
  }

  const data: {
    tickets: (StaffTicketRow | CustomerTicketRow)[];
    total: number;
    page: number;
    limit: number;
    // Plan 29: only present on the staff branch (see ticket.routes.ts's GET /) —
    // the customer branch skips filter/sort UI entirely, chips included.
    statusCounts?: Record<StaffTicketRow["status"], number>;
  } = await res.json();

  if (!isStaff) {
    return (
      <main className="min-h-[calc(100vh-57px)] p-4 md:p-8">
        <CustomerTicketList
          tickets={data.tickets as CustomerTicketRow[]}
          total={data.total}
          page={data.page}
          limit={data.limit}
          currentQuery={currentQuery.toString()}
        />
      </main>
    );
  }

  const categories: { name: string }[] = categoriesRes?.ok ? await categoriesRes.json() : [];
  const isAdmin = viewerRole === "admin";
  const canViewAll = isAdmin || viewerPermissions.includes("tickets:view_all");
  const canReassign = isAdmin || viewerPermissions.includes("tickets:reassign");
  const canDelete = isAdmin || viewerPermissions.includes("tickets:delete");
  const canViewStaffAccount = isAdmin || viewerPermissions.includes("staff:view_account");
  // Story 25's availability rule: admin/sub-admin bypass the online-only
  // restriction; a plain agent holding tickets:reassign does not.
  const viewerIsUnrestrictedReassigner = isAdmin || viewerRole === "subadmin";

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="tickets" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <StaffTicketQueue
          tickets={data.tickets as StaffTicketRow[]}
          total={data.total}
          page={data.page}
          limit={data.limit}
          statusCounts={
            data.statusCounts ?? { new: 0, in_progress: 0, answered: 0, escalated: 0, closed: 0 }
          }
          categories={categories.map((c) => c.name)}
          canViewAll={canViewAll}
          canReassign={canReassign}
          canDelete={canDelete}
          canViewStaffAccount={canViewStaffAccount}
          viewerIsUnrestrictedReassigner={viewerIsUnrestrictedReassigner}
          currentQuery={currentQuery.toString()}
          currentUserId={viewerId}
        />
      </main>
    </div>
  );
}
