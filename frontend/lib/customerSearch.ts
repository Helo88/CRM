import { MessageCircle, Ticket, TicketPlus, BookOpen } from "lucide-react";

// Customer-side counterpart to staffNav.ts's STAFF_NAV_ITEMS/STAFF_ACTION_ITEMS
// — surfaced in the same HeaderSearch component so ⌘K works for a customer
// too, not just staff. "startLiveChat" points at /chat (live-chat Story 14).
// "myTickets" points at /tickets (ticket-management Story 60), the same
// route staff's queue lives at — the page itself branches by role.
export const CUSTOMER_SEARCH_ITEMS = [
  { key: "newTicket", href: "/tickets/new", icon: TicketPlus },
  { key: "myTickets", href: "/tickets", icon: Ticket },
  { key: "startLiveChat", href: "/chat", icon: MessageCircle },
  // knowledge-base Story 31: a customer-facing DESTINATION, unrelated to
  // the KB admin-authoring actions Stories 29/30 deliberately keep out of
  // STAFF_ACTION_ITEMS — that exclusion is about admin authoring, not this.
  { key: "helpCenter", href: "/help", icon: BookOpen },
] as const;
