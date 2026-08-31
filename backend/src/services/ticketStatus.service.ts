import type { Types } from "mongoose";
import type { ITicketStatusHistoryEntry, TicketStatus } from "../models/Ticket";

// ticket-management Story 11: shared by the manual status-change route
// (PATCH /tickets/:id/status) and the reply flow's automatic "answered"
// flip (Story 56, ticket.routes.ts POST /:id/messages) so both paths log
// the same audit trail rather than one of them silently mutating
// `ticket.status` directly.
export type StatusChangeReason = "manual" | "auto_reply" | "auto_escalation";

export class InvalidStatusTransitionError extends Error {
  from: TicketStatus;
  to: TicketStatus;
  reason: StatusChangeReason;

  constructor(from: TicketStatus, to: TicketStatus, reason: StatusChangeReason) {
    super(`Cannot transition ticket status from "${from}" to "${to}"`);
    this.name = "InvalidStatusTransitionError";
    this.from = from;
    this.to = to;
    this.reason = reason;
  }
}

// "escalated" is only ever entered/exited through escalateTicket()
// (ticketEscalation.service.ts, Story 12) — that function additionally
// writes `escalatedTo` and fires notifications, which this generic helper
// knows nothing about. PATCH /:id/status still rejects a request that
// directly targets "escalated" at the validation layer
// (ALLOWED_MANUAL_STATUSES in ticket.schema.ts), even though the transition
// table below now allows it, so the only way in is the dedicated endpoint.
const ALLOWED_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus[]>> = {
  new: ["in_progress", "answered", "closed", "escalated"],
  in_progress: ["answered", "closed", "new", "escalated"],
  answered: ["in_progress", "closed", "escalated"],
  escalated: ["in_progress", "closed"],
  closed: ["in_progress"],
};

// Structural, not ITicket directly: callers pass both a plain Ticket
// document (PATCH /:id/status) and one whose `customer`/`assignedAgent`
// fields have been replaced by `.populate()` (POST /:id/messages's reply
// flow) — the populated shape no longer matches ITicket exactly, but both
// still have `status`/`statusHistory`/`save()`, which is all this helper
// touches.
export interface StatusMutableTicket {
  status: TicketStatus;
  statusHistory: ITicketStatusHistoryEntry[];
  save(): Promise<unknown>;
}

export interface ApplyStatusTransitionInput<T extends StatusMutableTicket> {
  ticket: T;
  nextStatus: TicketStatus;
  changedBy: Types.ObjectId;
  reason: StatusChangeReason;
}

// Permission checks stay at the route layer — this helper only knows
// whether a transition is legal, not who is allowed to request it.
export async function applyStatusTransition<T extends StatusMutableTicket>({
  ticket,
  nextStatus,
  changedBy,
  reason,
}: ApplyStatusTransitionInput<T>): Promise<T> {
  if (nextStatus === ticket.status) {
    return ticket;
  }
  const allowed = ALLOWED_TRANSITIONS[ticket.status];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new InvalidStatusTransitionError(ticket.status, nextStatus, reason);
  }

  ticket.statusHistory.push({ status: nextStatus, changedBy, changedAt: new Date() });
  ticket.status = nextStatus;
  await ticket.save();
  return ticket;
}
