import mongoose, { Document, Schema, Types } from "mongoose";
import { nextSequence } from "./Counter";

export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "new" | "in_progress" | "answered" | "escalated" | "closed";

export interface ITicketSla {
  responseTargetAt?: Date;
  resolutionTargetAt?: Date;
  breached: boolean;
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
  sla: ITicketSla;
  escalatedTo: Types.ObjectId | null;
  // Story 62 (live-chat): provenance only — set when the customer accepted
  // the AI's "open a ticket" suggestion from a live chat. Never consumed by
  // auto-assignment (Story 10) or any query filter, just a traceability link.
  sourceConversation: Types.ObjectId | null;
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

    sla: {
      responseTargetAt: Date,
      resolutionTargetAt: Date,
      breached: { type: Boolean, default: false },
    },

    escalatedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sourceConversation: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
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
