"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { fetchNotifications, markNotificationRead, type NotificationItem } from "@/app/actions/notifications";

const POLL_INTERVAL_MS = 60_000;

const TYPE_KEY: Record<NotificationItem["type"], string> = {
  ticket_assigned: "notificationTicketAssigned",
  ticket_escalated: "notificationTicketEscalated",
  ticket_reassigned: "notificationTicketReassigned",
  ticket_unassigned: "notificationTicketUnassigned",
  ticket_created: "notificationTicketCreated",
  ticket_auto_assigned: "notificationTicketAutoAssigned",
  ticket_needs_assignment: "notificationTicketNeedsAssignment",
};

// Story 54: was a static "coming soon" placeholder — now fetches on mount,
// polls every 60s while the tab is visible (paused in the background,
// refetched immediately on regaining focus), and refetches on route change
// so returning from a linked ticket updates the count. Polling, not
// Socket.io — the intake explicitly permits this and it keeps notifications
// out of the live-chat socket surface (see this story's plan).
export function NotificationBell() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const next = await fetchNotifications();
      setItems(next);
    });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  // Route change (e.g. returning from a linked ticket) — re-fetch so the
  // badge reflects any notification marked read while the user was away.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const unreadCount = items.filter((n) => !n.read).length;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  function handleItemClick(item: NotificationItem) {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    startTransition(async () => {
      await markNotificationRead(item.id);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-xl border-border bg-card shadow-soft"
          aria-label={t("notifications")}
        >
          <Bell className="size-[17px]" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            >
              {badgeLabel}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal text-muted-foreground">{t("notifications")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            {t("notificationsEmpty")}
          </DropdownMenuLabel>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild className="flex-col items-start gap-0.5">
              <Link href={`/tickets/${item.ticket.id}`} onClick={() => handleItemClick(item)}>
                <span className={item.read ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
                  {t(TYPE_KEY[item.type])}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.ticket.reference} — {item.ticket.subject}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
