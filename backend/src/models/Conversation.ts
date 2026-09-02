import mongoose, { Document, Schema, Types } from "mongoose";

export type ConversationStatus = "ai_handling" | "escalated" | "with_agent" | "resolved";

export interface IConversationSla {
  responseTargetAt?: Date;
  breached: boolean;
  // sla-automation Story 28: same single-fire bookkeeping as Ticket.sla —
  // see ITicketSla's atRiskAlerted for the full reasoning.
  atRiskAlerted: boolean;
}

/**
 * A live chat conversation (live-chat feature, Stories 14-19).
 * Messages are stored separately in the Message model (see Message.ts) so they can
 * be queried/paginated independently of the conversation document.
 */
export interface IConversation extends Document {
  customer: Types.ObjectId;
  assignedAgent: Types.ObjectId | null;
  status: ConversationStatus;
  sla: IConversationSla;
  // Story 62: once the customer declines the AI's "open a ticket" suggestion
  // once, the AI must not suggest again in this same conversation.
  aiTicketSuggestionDeclined: boolean;
  // Set the first time an agent/admin/subadmin actually sends a message in
  // this conversation — distinct from `assignedAgent` being set, which only
  // means the auto-assign picker claimed the conversation in the DB and
  // says nothing about whether that person has shown up. The customer-facing
  // "a support agent has joined" hint keys off this flag, not off assignment.
  agentJoinedAnnounced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User", default: null },

    status: {
      type: String,
      enum: ["ai_handling", "escalated", "with_agent", "resolved"],
      default: "ai_handling",
    },

    sla: {
      responseTargetAt: Date,
      breached: { type: Boolean, default: false },
      atRiskAlerted: { type: Boolean, default: false },
    },

    aiTicketSuggestionDeclined: { type: Boolean, default: false },
    agentJoinedAnnounced: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);
