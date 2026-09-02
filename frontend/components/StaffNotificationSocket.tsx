"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpCircle, MessageCircle, type LucideIcon } from "lucide-react";
import { API_URL } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationPushPayload {
  type: string;
  conversationId?: string;
  ticketId?: string;
}

// Shared rendering for every real-time push this socket handles — a plain
// popover card (not sonner's built-in warning/error skins, which read as
// alarming red even for amber-level "warning" — see the chat_needs_agent
// history above) with an icon whose tint carries the actual severity.
// duration: Infinity: these can arrive several at once with nothing
// auto-clearing them, so each one sits until a staff member acts on or
// dismisses it — <Toaster expand /> (app/layout.tsx) keeps them as a full
// vertical list instead of collapsing into a hover-to-peek pile.
function showStaffAlert(opts: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel: string;
}) {
  const Icon = opts.icon;
  toast.custom(
    (id) => (
      <div className="flex w-full items-start gap-3 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-[var(--shadow-pop)]">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", opts.iconClassName)}>
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm font-medium">{opts.title}</p>
          <div className="flex items-center gap-1">
            {opts.onAction && opts.actionLabel && (
              <Button
                size="sm"
                onClick={() => {
                  opts.onAction!();
                  toast.dismiss(id);
                }}
              >
                {opts.actionLabel}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => toast.dismiss(id)}>
              {opts.dismissLabel}
            </Button>
          </div>
        </div>
      </div>
    ),
    { duration: Infinity }
  );
}

// Trial (per user request): a real-time toast for "a live chat needs
// someone to claim it," on top of the existing 60s-polled NotificationBell
// (which still works exactly as before — this is purely additive). Mounted
// for every signed-in staff member from SiteHeader, kept alive for the
// whole session rather than scoped to a single chat page like
// LiveChatPanel.tsx/AgentChatPanel.tsx's connections. Harmless to mount for
// staff who aren't actually eligible recipients (agents without
// chats:manage) — the backend (notification.service.ts's notifyChatOversight)
// only ever emits to the personal room of a computed-eligible recipient, so
// an ineligible staff member's socket just never receives this event.
export function StaffNotificationSocket({ token }: { token: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();

  useEffect(() => {
    // This connection is kept alive for the whole session, unlike
    // LiveChatPanel.tsx/AgentChatPanel.tsx's page-scoped ones — so unlike
    // those, it's realistic for the ~15min access token to expire while
    // this is still mounted (a staff member just sitting on one page).
    // socket.io-client's default reconnection logic retries forever with
    // the SAME auth payload on every attempt, so once the server rejects a
    // stale token there is no amount of retrying that will ever succeed —
    // left alone this spams reconnect attempts indefinitely. `gaveUp` stops
    // that: on the first "Unauthorized" rejection, disconnect for good. A
    // fresh token arrives the next time this component remounts with a new
    // `token` prop — SiteHeader re-reads the session cookie on every
    // navigation, so browsing to a new page (which most staff do well
    // within 15 minutes) naturally reconnects with a valid one. A resumed
    // proper mid-session token refresh (matching the REST silent-refresh
    // pattern elsewhere in the app) is a follow-up, not part of this trial.
    let gaveUp = false;
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("notification:new", (payload: NotificationPushPayload) => {
      const dismissLabel = t("notificationDismiss");

      if (payload.type === "chat_needs_agent") {
        showStaffAlert({
          icon: MessageCircle,
          iconClassName: "bg-accent text-accent-foreground",
          title: t("notificationChatNeedsAgent"),
          actionLabel: payload.conversationId ? t("notificationChatNeedsAgentAction") : undefined,
          onAction: payload.conversationId ? () => router.push(`/chats/${payload.conversationId}`) : undefined,
          dismissLabel,
        });
        return;
      }

      if (payload.type === "sla_at_risk" || payload.type === "sla_breached") {
        const breached = payload.type === "sla_breached";
        // A notification carries exactly one of ticketId/conversationId
        // (see Notification.ts) — whichever is set says where this alert
        // links to.
        const href = payload.ticketId
          ? `/tickets/${payload.ticketId}`
          : payload.conversationId
            ? `/chats/${payload.conversationId}`
            : undefined;
        showStaffAlert({
          icon: breached ? ArrowUpCircle : AlertTriangle,
          // Same amber/red severity split as the SLA badges on the ticket
          // list and /notifications (TYPE_COLOR_CLASS there) — at-risk is a
          // caution, breached is the one that actually needs red.
          iconClassName: breached ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
          title: t(breached ? "notificationSlaBreached" : "notificationSlaAtRisk"),
          actionLabel: href ? (payload.ticketId ? t("notificationOpenTicket") : t("notificationChatNeedsAgentAction")) : undefined,
          onAction: href ? () => router.push(href) : undefined,
          dismissLabel,
        });
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[StaffNotificationSocket] connect error:", err.message);
      if (err.message === "Unauthorized" && !gaveUp) {
        gaveUp = true;
        socket.disconnect();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, t, router]);

  return null;
}
