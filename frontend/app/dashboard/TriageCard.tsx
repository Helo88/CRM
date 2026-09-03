import Link from "next/link";
import { MessageSquare, Ticket as TicketIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDateTime, formatSlaDelta } from "@/lib/utils";
import type { WorkspaceItem } from "@/app/actions/workspace";

// Duplicated from frontend/app/tickets/StaffTicketQueue.tsx:82-87 rather than
// imported: that module is an async Server Component, so importing a value
// out of it would drag it into this card's client bundle. Same four token
// classes, deliberately — a priority chip must not read differently on the
// board than it does in the queue. Keep the two in sync if either changes.
const PRIORITY_BADGE_CLASS: Record<NonNullable<WorkspaceItem["priority"]>, string> = {
  low: "border-border text-foreground",
  medium: "border-transparent bg-warning/10 text-warning",
  high: "border-transparent bg-destructive/10 text-destructive",
  urgent: "border-transparent bg-destructive/20 text-destructive",
};

const PRIORITY_KEY: Record<NonNullable<WorkspaceItem["priority"]>, string> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
  urgent: "priorityUrgent",
};

// One card on the triage board — a ticket or a live chat, told apart by the
// type icon/label on the top row, never by which list it sits in. The whole
// card is the link (not a trailing "View" affordance), same as the mobile
// ticket card in StaffTicketQueue.tsx.
export function TriageCard({ item, accentText }: { item: WorkspaceItem; accentText: string }) {
  const t = useTranslations("Dashboard");
  const tTickets = useTranslations("Tickets");

  const href = item.type === "ticket" ? `/tickets/${item.id}` : `/chats/${item.id}`;
  const isTicket = item.type === "ticket";
  const TypeIcon = isTicket ? TicketIcon : MessageSquare;

  const customerName = item.customer?.name ?? t("triage.unknownCustomer");
  // Tickets lead with their subject and carry the customer underneath; a
  // chat has no subject, so the customer name IS its title.
  const title = isTicket ? (item.title ?? customerName) : customerName;
  const subtitle = isTicket ? customerName : null;

  const delta = item.urgencyAt ? formatSlaDelta(item.urgencyAt) : null;
  const agentName = item.assignedAgent?.name ?? null;
  const agentInitial = agentName?.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <TypeIcon className="size-3.5 shrink-0" aria-hidden />
          {/* The icon alone doesn't say which kind of item this is to a
              screen reader; a ticket shows its reference visually, so the
              word "Ticket" rides along invisibly beside it. */}
          {isTicket ? <span className="sr-only">{t("triage.ticketLabel")}</span> : null}
          <span className={cn("truncate", isTicket && "font-mono")}>
            {isTicket ? item.reference : t("triage.chatLabel")}
          </span>
        </span>
        {item.priority ? (
          <Badge variant="outline" className={cn("shrink-0", PRIORITY_BADGE_CLASS[item.priority])}>
            {tTickets(PRIORITY_KEY[item.priority])}
          </Badge>
        ) : null}
      </div>

      <p className="mt-1.5 line-clamp-2 text-sm font-medium">{title}</p>
      {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        {/* Relative deltas are computed at render time on both the server and
            the client, so a card rendered either side of a minute boundary can
            differ by one minute on hydration — harmless, and suppressed rather
            than papered over with a mount-only render that would flash. */}
        <span
          suppressHydrationWarning
          className={cn("text-xs font-medium", delta ? accentText : "text-muted-foreground")}
          title={item.urgencyAt ? formatDateTime(item.urgencyAt) : undefined}
        >
          {delta
            ? delta.overdue
              ? t("triage.overdueBy", { delta: delta.text })
              : t("triage.timeLeft", { delta: delta.text })
            : t("triage.noTarget")}
        </span>
        {agentName ? (
          <span title={t("triage.assignedTo", { name: agentName })}>
            <Avatar size="sm">
              <AvatarFallback aria-hidden>{agentInitial}</AvatarFallback>
            </Avatar>
            <span className="sr-only">{t("triage.assignedTo", { name: agentName })}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
