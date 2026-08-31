import mongoose, { Document, Schema, Types } from "mongoose";

// Story 54 (ticket-management): in-app notifications for ticket events.
// "ticket_reassigned" was added alongside the manual-reassignment feature
// (ticket-management Story 25) — the intake this model was originally
// scoped from only anticipated "assigned"/"escalated" (Story 10 and a future
// Story 12), but a manually reassigned ticket needs the same "you have new
// work, here's the link" nudge as an auto-assigned one.
export type NotificationType = "ticket_assigned" | "ticket_escalated" | "ticket_reassigned";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  type: NotificationType;
  ticketId: Types.ObjectId;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["ticket_assigned", "ticket_escalated", "ticket_reassigned"], required: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Backs "my unread count" and "my notifications, unread-first" — the two
// queries GET /me/notifications actually runs.
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
