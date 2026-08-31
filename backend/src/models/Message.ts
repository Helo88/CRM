import mongoose, { Document, Schema, Types } from "mongoose";

export type MessageParentType = "ticket" | "conversation";
export type MessageSenderType = "customer" | "agent" | "ai" | "system";

export interface IMessageAttachment {
  _id: Types.ObjectId;
  fileName: string;
  // The PROTECTED route path the frontend links to (e.g.
  // /api/v1/tickets/<ticketId>/messages/<messageId>/attachments/<attachmentId>)
  // — never a raw filesystem path. Same reasoning as User.ts's IAttachment.
  url: string;
  // The opaque on-disk filename multer generated at upload time (see
  // backend/src/middleware/upload.ts's ticket-scoped storage) — internal
  // only, never included in any API response.
  storageFileName: string;
  // Bytes, populated server-side from multer's file.size.
  size: number;
}

/**
 * A single message on either a Ticket thread or a Conversation (live chat).
 * `parentType` + `parentId` let one model serve both, per CLAUDE.md's data model notes.
 * `senderType: "ai"` covers AI agent replies (live-chat Story 15, ai-features Stories 31-34);
 * `internal: true` covers agent-only notes (agent-workspace Story 24) — never shown to the customer.
 */
export interface IAiTicketSuggestion {
  subject: string;
  description: string;
}

export interface IMessage extends Document {
  parentType: MessageParentType;
  parentId: Types.ObjectId;
  senderType: MessageSenderType;
  senderId: Types.ObjectId | null;
  text: string;
  internal: boolean;
  attachments: IMessageAttachment[];
  // Story 62 (live-chat): set on an "ai" message when Gemini's classifier
  // decided this reply should offer a one-click "open a ticket" suggestion.
  // Persisted (not just emitted) so the card re-hydrates correctly on
  // reconnect/history reload.
  aiTicketSuggestion: IAiTicketSuggestion | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    parentType: { type: String, enum: ["ticket", "conversation"], required: true },
    parentId: { type: Schema.Types.ObjectId, required: true },

    senderType: { type: String, enum: ["customer", "agent", "ai", "system"], required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    text: { type: String, required: true },
    internal: { type: Boolean, default: false },

    attachments: [
      {
        fileName: { type: String, required: true },
        url: { type: String, required: true },
        storageFileName: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],

    aiTicketSuggestion: {
      type: new Schema({ subject: String, description: String }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ parentType: 1, parentId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
