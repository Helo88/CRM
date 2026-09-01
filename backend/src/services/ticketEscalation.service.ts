import { Types } from "mongoose";
import { ITicket } from "../models/Ticket";
import { User } from "../models/User";
import { applyStatusTransition, InvalidStatusTransitionError } from "./ticketStatus.service";
import { createTicketNotification, notifyTicketOversight } from "./notification.service";

export { InvalidStatusTransitionError };

// ticket-management Story 12: reason is threaded through to
// applyStatusTransition's own StatusChangeReason so the statusHistory audit
// trail records *why* a ticket became escalated, not just that it did.
// "sla_breach" isn't wired up by anything yet — sla-automation's Story 28
// (auto-escalation) is the future caller that will pass it; escalateTicket
// is exported specifically so that story can call this directly instead of
// duplicating the notification/validation logic in a timer job.
export type EscalationReason = "manual" | "sla_breach";

export class InvalidEscalationTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEscalationTargetError";
  }
}

export interface EscalateTicketInput {
  ticket: ITicket;
  escalatedToUserId: Types.ObjectId;
  changedBy: Types.ObjectId;
  reason: EscalationReason;
}

// Manual escalation (Story 12) — sets status: "escalated" and escalatedTo,
// appends to statusHistory via applyStatusTransition, and notifies the
// target plus oversight. Never clears/resets any other ticket field:
// assignedAgent, category, priority, customer, and messages are untouched —
// escalation is additive, not a handoff (reassignment is Story 25's job).
export async function escalateTicket({
  ticket,
  escalatedToUserId,
  changedBy,
  reason,
}: EscalateTicketInput): Promise<ITicket> {
  if (escalatedToUserId.equals(changedBy)) {
    throw new InvalidEscalationTargetError("You cannot escalate a ticket to yourself");
  }

  const target = await User.findOne({
    _id: escalatedToUserId,
    role: { $in: ["agent", "admin", "subadmin"] },
    isActive: true,
    isDeleted: { $ne: true },
  }).select("_id");
  if (!target) {
    throw new InvalidEscalationTargetError("Escalation target must be an active agent or admin");
  }

  ticket.escalatedTo = escalatedToUserId;
  await applyStatusTransition({
    ticket,
    nextStatus: "escalated",
    changedBy,
    reason: reason === "sla_breach" ? "auto_escalation" : "manual",
  });

  await createTicketNotification({ recipient: escalatedToUserId, type: "ticket_escalated", ticketId: ticket._id });
  await notifyTicketOversight({ type: "ticket_escalated", ticketId: ticket._id });

  return ticket;
}
