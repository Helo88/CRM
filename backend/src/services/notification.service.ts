import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification";
import { User } from "../models/User";

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

// Oversight notifications ("a new ticket came in", "a ticket was
// auto-assigned") go to admins unconditionally plus subadmins holding
// tickets:view_all — not every subadmin, matching the project's
// per-individual-account permission model (a fresh subadmin is granted
// nothing by default, so blanket-notifying every subadmin would tell
// someone about tickets they have no other visibility into). Admin has no
// permissions array of its own (implicit full access), hence the separate
// $or branch rather than a single permissions filter.
export async function notifyTicketOversight(params: {
  type: NotificationType;
  ticketId: Types.ObjectId | string;
}): Promise<void> {
  try {
    const recipients = await User.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ role: "admin" }, { role: "subadmin", permissions: "tickets:view_all" }],
    })
      .select("_id")
      .lean();
    if (recipients.length === 0) return;
    await Notification.insertMany(
      recipients.map((recipient) => ({ recipient: recipient._id, type: params.type, ticketId: params.ticketId }))
    );
  } catch (err) {
    console.error("[notifications] failed to create oversight notifications", err);
  }
}

// live-chat: conversation-side counterpart of notifyTicketOversight above,
// fired on EVERY escalation (chat.socket.ts's conversation:escalate
// handler) — unlike tickets, chat has no auto-assign step to attempt first,
// so there's no "only when that failed" condition here. Deliberately
// broader than the ticket version's recipient set: a ticket needing manual
// reassignment can only be rescued by oversight (admin/tickets:view_all
// subadmin), but a chat can be claimed by any agent who holds chats:manage
// — the same permission scope the "Join chat" action itself requires — so
// plain agents holding that permission are notified too, not just
// oversight roles.
export async function notifyChatOversight(params: {
  type: NotificationType;
  conversationId: Types.ObjectId | string;
}): Promise<void> {
  try {
    const recipients = await User.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [
        { role: "admin" },
        { role: "subadmin", permissions: "chats:manage" },
        { role: "agent", permissions: "chats:manage" },
      ],
    })
      .select("_id")
      .lean();
    if (recipients.length === 0) return;
    await Notification.insertMany(
      recipients.map((recipient) => ({
        recipient: recipient._id,
        type: params.type,
        conversationId: params.conversationId,
      }))
    );
  } catch (err) {
    console.error("[notifications] failed to create chat oversight notifications", err);
  }
}
