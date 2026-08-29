import { MessageCircle, TicketPlus } from "lucide-react";

// Customer-side counterpart to staffNav.ts's STAFF_NAV_ITEMS/STAFF_ACTION_ITEMS
// — surfaced in the same HeaderSearch component so ⌘K works for a customer
// too, not just staff. "startLiveChat" points at /chat, which 404s until
// live-chat Story 14 lands — same accepted pattern as Story 53's support
// page linking to routes before their story ships.
export const CUSTOMER_SEARCH_ITEMS = [
  { key: "newTicket", href: "/tickets/new", icon: TicketPlus },
  { key: "startLiveChat", href: "/chat", icon: MessageCircle },
] as const;
