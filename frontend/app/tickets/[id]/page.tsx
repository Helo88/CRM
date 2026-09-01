import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { StaffSidebar } from "@/components/StaffSidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TicketDetailSidebar } from "./TicketDetailSidebar";
import { TicketMessageThread } from "./TicketMessageThread";
import { TicketReplyComposer } from "./TicketReplyComposer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TicketDetail");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

interface TicketDetailResponse {
  id: string;
  reference: string;
  subject: string;
  description: string;
  status: "new" | "in_progress" | "answered" | "escalated" | "closed";
  category: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  customer: { id: string; name: string; email: string };
  assignedAgent: { id: string; name: string } | null;
  escalatedTo: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessageAttachment {
  id: string;
  fileName: string;
  size: number;
  url: string;
}

export interface TicketMessage {
  id: string;
  text: string;
  senderType: "customer" | "agent" | "ai" | "system";
  sender: { id: string; name: string } | null;
  internal: boolean;
  attachments: TicketMessageAttachment[];
  createdAt: string;
}

const STATUS_KEY: Record<TicketDetailResponse["status"], string> = {
  new: "statusNew",
  in_progress: "statusInProgress",
  answered: "statusAnswered",
  escalated: "statusEscalated",
  closed: "statusClosed",
};

// Story 9: the first ticket-detail page — staff-only (agent/admin/subadmin),
// scoped to what this story needs (viewing a ticket's context, editing its
// Category/Priority). Story 56 (reply) and Story 11 (status) extend this
// same page later rather than forking a second one. Gating mirrors
// customers/[id]/page.tsx: cookie → access-token presence → silent-refresh
// redirect → fetch → 401 refresh dance → role/404 handling.
export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { id } = await params;
  const { _refreshed } = await searchParams;
  const t = await getTranslations("TicketDetail");
  const tNav = await getTranslations("Nav");

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/tickets/${id}`);
    }
    redirect("/");
  }

  const { id: viewerId, role, permissions: viewerPermissions = [] } = peekJwtPayload(accessToken);
  const isStaffViewer = role === "agent" || role === "admin" || role === "subadmin";
  if (!isStaffViewer && role !== "customer") {
    redirect("/dashboard");
  }

  const [res, messagesRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/tickets/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
    fetch(`${API_URL}/api/v1/tickets/${id}/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
  ]);

  if (res.status === 401) {
    if (!_refreshed) {
      redirect(`/api/session/refresh?next=/tickets/${id}`);
    }
    redirect("/login");
  }

  if (res.status === 403) {
    redirect("/dashboard");
  }

  if (res.status === 404) {
    return (
      <div className="flex min-h-[calc(100vh-57px)]">
        <StaffSidebar />
        <main className="flex min-w-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground">{t("notFound")}</p>
        </main>
      </div>
    );
  }

  if (!res.ok) {
    redirect("/dashboard");
  }

  const ticket: TicketDetailResponse = await res.json();
  const messages: TicketMessage[] = messagesRes.ok ? await messagesRes.json() : [];
  const isViewerAdmin = role === "admin";
  const canCategorize = isStaffViewer && (isViewerAdmin || viewerPermissions.includes("tickets:categorize"));
  const canChangePriority = isStaffViewer && (isViewerAdmin || viewerPermissions.includes("tickets:change_priority"));
  const canReply = isStaffViewer && (isViewerAdmin || viewerPermissions.includes("tickets:reply"));
  const canReassign = isStaffViewer && (isViewerAdmin || viewerPermissions.includes("tickets:reassign"));
  // Story 11: two independent keys, same "check separately" shape as the
  // other per-field booleans above — an account can hold either without
  // the other.
  const canChangeStatus = isStaffViewer && (isViewerAdmin || viewerPermissions.includes("tickets:change_status"));
  const canCloseReopen = isStaffViewer && (isViewerAdmin || viewerPermissions.includes("tickets:close_reopen"));
  // Story 12: manual escalation to a senior agent or admin.
  const canEscalate = isStaffViewer && (isViewerAdmin || viewerPermissions.includes("tickets:escalate"));
  // Story 11's read-only-when-closed rule: Category/Priority/Assigned Agent
  // lock regardless of the viewer's own permission for that field, and the
  // reply composer is hidden outright. The status control is exempt — it
  // stays interactive for a canCloseReopen holder, so the ticket can be
  // reopened.
  const isLocked = ticket.status === "closed";
  // Story 25's availability rule: admin/sub-admin bypass the online-only
  // restriction; a plain agent holding tickets:reassign does not.
  const viewerIsUnrestrictedReassigner = isViewerAdmin || role === "subadmin";

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      {isStaffViewer && <StaffSidebar active="tickets" />}
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto w-full max-w-4xl">
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link href="/tickets" className="hover:text-foreground hover:underline">
              {tNav("tickets")}
            </Link>
            <span className="mx-2">/</span>
            <span className="font-medium text-foreground">{ticket.reference}</span>
          </nav>
          <div className={`gap-6 ${isStaffViewer ? "grid md:grid-cols-[1fr_18rem]" : "flex flex-col"}`}>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-xl">{ticket.subject}</CardTitle>
                  {/* Story 60: customer-facing read-only view shows status inline
                      here instead of in the staff-only sidebar Card below. */}
                  {!isStaffViewer && (
                    <Badge variant="outline" className="shrink-0">
                      {t(STATUS_KEY[ticket.status])}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
                {isStaffViewer && (
                  <div className="flex flex-col gap-1 border-t border-border pt-4">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("customer")}</span>
                    <span className="text-sm">
                      {ticket.customer.name} — {ticket.customer.email}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("thread")}</span>
                  <TicketMessageThread messages={messages} ticketId={ticket.id} />
                  {/* Story 61 (deferred): customer email replies aren't captured yet — see USER_STORIES.md. */}
                  {isStaffViewer && <p className="text-xs italic text-muted-foreground">{t("emailReplyComingSoon")}</p>}
                  {/* Story 11: a closed ticket is read-only — the composer never
                      renders, regardless of canReply, until it's reopened. */}
                  {isLocked && isStaffViewer && (
                    <p className="text-xs italic text-muted-foreground">{t("ticketClosedReadOnly")}</p>
                  )}
                  {canReply && !isLocked && <TicketReplyComposer ticketId={ticket.id} />}
                </div>
              </CardContent>
            </Card>

            {isStaffViewer && (
              <Card size="sm" className="h-fit">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                    {t("heading")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <TicketDetailSidebar
                    ticketId={ticket.id}
                    status={ticket.status}
                    category={ticket.category}
                    priority={ticket.priority}
                    assignedAgent={ticket.assignedAgent}
                    escalatedTo={ticket.escalatedTo}
                    currentUserId={viewerId}
                    canCategorize={canCategorize}
                    canChangePriority={canChangePriority}
                    canReassign={canReassign}
                    canChangeStatus={canChangeStatus}
                    canCloseReopen={canCloseReopen}
                    canEscalate={canEscalate}
                    isLocked={isLocked}
                    viewerIsUnrestrictedReassigner={viewerIsUnrestrictedReassigner}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
