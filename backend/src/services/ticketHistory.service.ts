import { Types } from "mongoose";
import { Ticket } from "../models/Ticket";
import { Message } from "../models/Message";
import { User } from "../models/User";

// ticket-management Story 13: aggregates every meaningful thing that has
// happened on a ticket (creation, status changes, replies, internal notes)
// into one chronological timeline. Category/assignment changes have no
// history sub-document yet (see Ticket.ts) — TODO(story-future) below.
export type TicketHistoryEventKind = "created" | "status_changed" | "reply_posted" | "internal_note_added";

export interface TicketHistoryEvent {
  kind: TicketHistoryEventKind;
  at: Date;
  actor: { id: string; name: string | null; role: string } | null;
  data: Record<string, unknown>;
}

export class TicketNotFoundError extends Error {
  constructor() {
    super("Ticket not found");
    this.name = "TicketNotFoundError";
  }
}

export interface BuildTicketHistoryOptions {
  // Set when the caller is the ticket's own customer: internal notes are
  // agent-only (see Message.ts's doc comment) and must never reach this
  // branch, even though customers can't reach the export route at all.
  viewerRole?: string;
  // Reserved for a future customer-portal reuse of this aggregator (Story
  // 37 mirrors Story 6's query pattern the same way) — defaults to false
  // since nothing consumes it yet.
  redactInternalBodies?: boolean;
}

export async function buildTicketHistory(
  ticketId: Types.ObjectId,
  options: BuildTicketHistoryOptions = {}
): Promise<TicketHistoryEvent[]> {
  const ticket = await Ticket.findById(ticketId)
    .populate<{ customer: { _id: Types.ObjectId; name: string } | null }>("customer", "name")
    .populate<{ escalatedTo: { _id: Types.ObjectId; name: string } | null }>("escalatedTo", "name");
  if (!ticket) {
    throw new TicketNotFoundError();
  }

  const events: TicketHistoryEvent[] = [];

  events.push({
    kind: "created",
    at: ticket.createdAt,
    actor: ticket.customer ? { id: ticket.customer._id.toString(), name: ticket.customer.name, role: "customer" } : null,
    data: { ticketNumber: ticket.ticketNumber, subject: ticket.subject },
  });

  const changedByIds = [...new Set(ticket.statusHistory.map((entry) => entry.changedBy.toString()))];
  const changedByUsers =
    changedByIds.length > 0
      ? await User.find({ _id: { $in: changedByIds } }, { name: 1, role: 1 }).lean()
      : [];
  const changedByMap = new Map(changedByUsers.map((u) => [u._id.toString(), u]));

  const lastEscalatedIndex = [...ticket.statusHistory].map((e) => e.status).lastIndexOf("escalated");
  ticket.statusHistory.forEach((entry, index) => {
    const changer = changedByMap.get(entry.changedBy.toString());
    events.push({
      kind: "status_changed",
      at: entry.changedAt,
      actor: changer ? { id: entry.changedBy.toString(), name: changer.name, role: changer.role } : null,
      data: {
        to: entry.status,
        ...(entry.status === "escalated" && index === lastEscalatedIndex && ticket.escalatedTo
          ? { escalatedTo: { id: ticket.escalatedTo._id.toString(), name: ticket.escalatedTo.name } }
          : {}),
      },
    });
  });

  const messageFilter: Record<string, unknown> = { parentType: "ticket", parentId: ticket._id };
  if (options.viewerRole === "customer") {
    messageFilter.internal = { $ne: true };
  }
  const messages = await Message.find(messageFilter)
    .sort({ createdAt: 1 })
    .populate<{ senderId: { _id: Types.ObjectId; name: string; role: string } | null }>("senderId", "name role");

  for (const message of messages) {
    events.push({
      kind: message.internal ? "internal_note_added" : "reply_posted",
      at: message.createdAt,
      actor: message.senderId
        ? { id: message.senderId._id.toString(), name: message.senderId.name, role: message.senderId.role }
        : null,
      data: { messageId: message._id.toString() },
    });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return events;
}

// TODO(story-future): this timeline has no "category_changed" or
// "assignee_changed" event kind — Ticket.ts carries only current-state
// scalars (category, assignedAgent), not a history array, for either field
// (unlike statusHistory). Whichever future story adds an audit-log
// sub-document for Story 9 (categorize) / Story 25 (reassign) should wire
// the new event source into buildTicketHistory above, not build a second
// aggregator.
