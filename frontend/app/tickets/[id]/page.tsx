import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  subject: string;
  description: string;
  status: "new" | "in_progress" | "answered" | "escalated" | "closed";
  category: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  customer: { id: string; name: string; email: string };
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

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/tickets/${id}`);
    }
    redirect("/");
  }

  const { role, permissions: viewerPermissions = [] } = peekJwtPayload(accessToken);
  if (role !== "agent" && role !== "admin" && role !== "subadmin") {
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
  const canCategorize = isViewerAdmin || viewerPermissions.includes("tickets:categorize");
  const canChangePriority = isViewerAdmin || viewerPermissions.includes("tickets:change_priority");
  const canReply = isViewerAdmin || viewerPermissions.includes("tickets:reply");

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-[1fr_18rem]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{ticket.subject}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
              <div className="flex flex-col gap-1 border-t border-border pt-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("customer")}</span>
                <span className="text-sm">
                  {ticket.customer.name} — {ticket.customer.email}
                </span>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("thread")}</span>
                <TicketMessageThread messages={messages} ticketId={ticket.id} />
                {/* Story 61 (deferred): customer email replies aren't captured yet — see USER_STORIES.md. */}
                <p className="text-xs italic text-muted-foreground">{t("emailReplyComingSoon")}</p>
                {canReply && <TicketReplyComposer ticketId={ticket.id} />}
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                {t("heading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t("status")}</span>
                <Badge variant="outline" className="w-fit">
                  {t(STATUS_KEY[ticket.status])}
                </Badge>
              </div>
              <TicketDetailSidebar
                ticketId={ticket.id}
                category={ticket.category}
                priority={ticket.priority}
                canCategorize={canCategorize}
                canChangePriority={canChangePriority}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
