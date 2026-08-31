import mongoose, { Document, Schema, Types } from "mongoose";

// Story 54 (ticket-management): in-app notifications for ticket events.
// "ticket_reassigned" was added alongside the manual-reassignment feature
// (ticket-management Story 25) — the intake this model was originally
// scoped from only anticipated "assigned"/"escalated" (Story 10 and a future
// Story 12), but a manually reassigned ticket needs the same "you have new
// work, here's the link" nudge as an auto-assigned one. "ticket_unassigned"
// is the outgoing-assignee counterpart: reassignment notifies two different
// people with two different facts ("you got this" vs. "you no longer have
// this"), so it can't share "ticket_reassigned"'s "reassigned to you" text.
// "ticket_created" and "ticket_auto_assigned" are the oversight counterparts
// of ticket creation/auto-assignment (notifyTicketOversight in
// notification.service.ts) — sent to admins and tickets:view_all subadmins
// rather than the assignee, so they can't reuse "ticket_assigned"'s
// assignee-facing "...to you" text either. "ticket_needs_assignment" covers
// the case auto-assignment can't handle at all: no agent was online, so the
// ticket was created/left unassigned — oversight has to step in and use
// manual reassignment (Story 25) since there was nobody to auto-assign to.
// "ticket_reopened" / "ticket_reopened_oversight" (Story 11): same
// assignee-vs-oversight split as creation above, sent together whenever a
// PATCH /:id/status transition takes a ticket OUT of "closed" — the
// assigned agent (if any) gets the "to you" nudge, admins/tickets:view_all
// subadmins get the oversight fact regardless of whether the ticket is
// assigned. Unlike reassignment (Story 25), which only notifies the two
// agents involved, reopening is oversight-worthy on its own — a ticket
// coming back from "closed" is more consequential than a routine handoff.
export type NotificationType =
  | "ticket_assigned"
  | "ticket_escalated"
  | "ticket_reassigned"
  | "ticket_unassigned"
  | "ticket_created"
  | "ticket_auto_assigned"
  | "ticket_needs_assignment"
  | "ticket_reopened"
  | "ticket_reopened_oversight";

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
    type: {
      type: String,
      enum: [
        "ticket_assigned",
        "ticket_escalated",
        "ticket_reassigned",
        "ticket_unassigned",
        "ticket_created",
        "ticket_auto_assigned",
        "ticket_needs_assignment",
        "ticket_reopened",
        "ticket_reopened_oversight",
      ],
      required: true,
    },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Backs "my unread count" and "my notifications, unread-first" — the two
// queries GET /me/notifications actually runs.
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
