import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification";

// A notification is a best-effort side effect of the real action (assigning
// or reassigning a ticket) — same reasoning as the acknowledgment/assignment
// emails in ticket.routes.ts: never let a DB hiccup here fail or roll back
// the request that triggered it, only log.
export async function createTicketNotification(params: {
  recipient: Types.ObjectId | string;
  type: NotificationType;
  ticketId: Types.ObjectId | string;
}): Promise<void> {
  try {
    await Notification.create(params);
  } catch (err) {
    console.error("[notifications] failed to create", err);
  }
}
