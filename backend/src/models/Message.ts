import mongoose, { Document, Schema, Types } from "mongoose";

export type MessageParentType = "ticket" | "conversation";
export type MessageSenderType = "customer" | "agent" | "ai" | "system";

export interface IMessageAttachment {
  fileName: string;
  url: string;
}

/**
 * A single message on either a Ticket thread or a Conversation (live chat).
 * `parentType` + `parentId` let one model serve both, per CLAUDE.md's data model notes.
 * `senderType: "ai"` covers AI agent replies (live-chat Story 15, ai-features Stories 31-34);
 * `internal: true` covers agent-only notes (agent-workspace Story 24) — never shown to the customer.
 */
export interface IMessage extends Document {
  parentType: MessageParentType;
  parentId: Types.ObjectId;
  senderType: MessageSenderType;
  senderId: Types.ObjectId | null;
  text: string;
  internal: boolean;
  attachments: IMessageAttachment[];
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
        fileName: String,
        url: String,
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ parentType: 1, parentId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
