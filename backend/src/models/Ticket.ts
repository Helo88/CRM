import mongoose, { Document, Schema, Types } from "mongoose";
import { nextSequence } from "./Counter";

export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "new" | "in_progress" | "answered" | "escalated" | "closed";
// ticket-management Story 63: how the ticket actually reached the system —
// "customer_portal" for a plain self-submit, "ai" for a self-submit that
// originated from accepting the live-chat AI agent's "open a ticket"
// suggestion (sourceConversation is set — see ticket.routes.ts), or one of
// the other four for a staff-logged ticket (the staff caller must pick one).
// Neither "customer_portal" nor "ai" is ever client-suppliable — both are
// derived server-side from which branch/inputs the request actually took.
export type TicketCreationChannel = "customer_portal" | "ai" | "phone" | "email" | "in_person" | "other";

// sla-automation Story 26: `breached` is stored but intentionally never
// flipped by this story — there's no scheduled job scanning for breaches
// yet, so a ticket that breaches while unqueried stays `breached: false`
// here. That's fine because slaStatus is derived on read (see
// sla.service.ts's computeSlaStatus). A future story owns the scheduler
// that would actually flip this field for proactive alerting.
export interface ITicketSla {
  responseTargetAt?: Date;
  resolutionTargetAt?: Date;
  breached: boolean;
}

export interface ITicketStatusHistoryEntry {
  status: TicketStatus;
  changedBy: Types.ObjectId;
  changedAt: Date;
}

// ticket-management Story 13 follow-up: category/priority/assignedAgent
// used to have no audit trail at all — only the current-state scalar field
// existed, so a change was silent (nothing for buildTicketHistory to read).
// Mirrors ITicketStatusHistoryEntry's shape exactly, one array per field.
export interface ITicketCategoryHistoryEntry {
  category: string | null;
  changedBy: Types.ObjectId;
  changedAt: Date;
}

export interface ITicketPriorityHistoryEntry {
  priority: TicketPriority;
  changedBy: Types.ObjectId;
  changedAt: Date;
}

export interface ITicketAssignedAgentHistoryEntry {
  assignedAgent: Types.ObjectId | null;
  changedBy: Types.ObjectId;
  changedAt: Date;
}

// live-chat: append-only log of a staff member claiming/releasing a live
// chat that has a ticket opened from it (sourceConversation below) — same
// shape/reasoning as the four history arrays above, recorded from
// chat.socket.ts's conversation:claim/conversation:unclaim handlers (and
// the disconnect fallback that auto-releases an abandoned claim).
export interface ITicketChatPresenceHistoryEntry {
  event: "joined" | "left";
  user: Types.ObjectId;
  at: Date;
}

/**
 * Supports the ticket-management feature (Stories 8-13) and the sla-automation
 * feature (Stories 25-27) via the sla sub-document.
 */
export interface ITicket extends Document {
  ticketNumber: number;
  subject: string;
  description: string;
  customer: Types.ObjectId;
  assignedAgent: Types.ObjectId | null;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  // ticket-management Story 11: append-only audit trail of every status
  // change (who, when) — deliberately minimal rather than a first-class
  // history collection; Story 13 may migrate this into a real history model
  // later.
  statusHistory: ITicketStatusHistoryEntry[];
  categoryHistory: ITicketCategoryHistoryEntry[];
  priorityHistory: ITicketPriorityHistoryEntry[];
  assignedAgentHistory: ITicketAssignedAgentHistoryEntry[];
  chatPresenceHistory: ITicketChatPresenceHistoryEntry[];
  sla: ITicketSla;
  escalatedTo: Types.ObjectId | null;
  // Story 62 (live-chat): provenance only — set when the customer accepted
  // the AI's "open a ticket" suggestion from a live chat. Never consumed by
  // auto-assignment (Story 10) or any query filter, just a traceability link.
  sourceConversation: Types.ObjectId | null;
  // ticket-management Story 63: provenance-only, same "never consumed by a
  // query filter" shape as sourceConversation above — the actual creator
  // (customer or staff-on-behalf-of) and the channel they used. Both `null`
  // on tickets created before this story shipped; no backfill migration.
  createdBy: Types.ObjectId | null;
  createdVia: TicketCreationChannel | null;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: Number, unique: true, required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User", default: null },

    category: { type: String, default: null },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    status: {
      type: String,
      enum: ["new", "in_progress", "answered", "escalated", "closed"],
      default: "new",
    },
    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: ["new", "in_progress", "answered", "escalated", "closed"],
            required: true,
          },
          changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          changedAt: { type: Date, required: true },
        },
      ],
      default: [],
      _id: false,
    },
    categoryHistory: {
      type: [
        {
          category: { type: String, default: null },
          changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          changedAt: { type: Date, required: true },
        },
      ],
      default: [],
      _id: false,
    },
    priorityHistory: {
      type: [
        {
          priority: { type: String, enum: ["low", "medium", "high", "urgent"], required: true },
          changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          changedAt: { type: Date, required: true },
        },
      ],
      default: [],
      _id: false,
    },
    assignedAgentHistory: {
      type: [
        {
          assignedAgent: { type: Schema.Types.ObjectId, ref: "User", default: null },
          changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          changedAt: { type: Date, required: true },
        },
      ],
      default: [],
      _id: false,
    },
    chatPresenceHistory: {
      type: [
        {
          event: { type: String, enum: ["joined", "left"], required: true },
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          at: { type: Date, required: true },
        },
      ],
      default: [],
      _id: false,
    },

    sla: {
      responseTargetAt: Date,
      resolutionTargetAt: Date,
      breached: { type: Boolean, default: false },
    },

    escalatedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sourceConversation: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdVia: {
      type: String,
      enum: ["customer_portal", "ai", "phone", "email", "in_person", "other"],
      default: null,
    },
  },
  { timestamps: true }
);

// pre("validate"), same reasoning as User.ts's membershipNumber hook: required:
// true is enforced during validation, which runs before "save" middleware, so
// the number must exist by then. Runs for every creation path (customer
// self-submit, staff create-on-behalf-of) since they all go through
// Ticket.create()/doc.save().
ticketSchema.pre("validate", async function (next) {
  if (this.isNew && !this.ticketNumber) {
    this.ticketNumber = await nextSequence("ticketNumber");
  }
  next();
});

export const Ticket = mongoose.model<ITicket>("Ticket", ticketSchema);
