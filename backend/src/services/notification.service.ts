import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification";
import { User } from "../models/User";
import { getIoInstance } from "../sockets/ioRegistry";

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
    // Real-time push scoped to sla_at_risk/sla_breached only, same trial
    // widening as notifyChatOversight below — this function also carries
    // ticket_assigned/escalated/reassigned/... traffic that stays DB-only
    // (the 60s-polled NotificationBell still covers those).
    if (params.type === "sla_at_risk" || params.type === "sla_breached") {
      const io = getIoInstance();
      if (io) {
        io.to(`user:${params.recipient.toString()}`).emit("notification:new", {
          type: params.type,
          ticketId: params.ticketId.toString(),
        });
      }
    }
  } catch (err) {
    console.error("[notifications] failed to create", err);
  }
}

// sla-automation Story 28: single, specific-recipient notification about a
// conversation — the gap createTicketNotification (ticket-keyed) and
// notifyChatOversight (broadcast, conversation-keyed) don't cover. Used by
// the SLA monitor to alert a conversation's assignedAgent directly — the
// only two types it's ever called with, so the real-time push below is
// unconditional rather than gated by type like the other three functions in
// this file (which also carry non-SLA traffic that stays DB-only).
export async function createConversationNotification(params: {
  recipient: Types.ObjectId | string;
  type: NotificationType;
  conversationId: Types.ObjectId | string;
}): Promise<void> {
  try {
    await Notification.create(params);
    const io = getIoInstance();
    if (io) {
      io.to(`user:${params.recipient.toString()}`).emit("notification:new", {
        type: params.type,
        conversationId: params.conversationId.toString(),
      });
    }
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

    // Same sla_at_risk/sla_breached-only real-time push as createTicketNotification
    // and notifyChatOversight — ticket_created/ticket_auto_assigned/etc. stay DB-only.
    if (params.type === "sla_at_risk" || params.type === "sla_breached") {
      const io = getIoInstance();
      if (io) {
        for (const recipient of recipients) {
          io.to(`user:${recipient._id.toString()}`).emit("notification:new", {
            type: params.type,
            ticketId: params.ticketId.toString(),
          });
        }
      }
    }
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

    // Trial (per user request): a real-time nudge on top of the DB-backed
    // notification above (which the bell still polls for as before — this
    // doesn't replace it). Started scoped to just "chat_needs_agent";
    // widened to sla_at_risk/sla_breached once that trial went well — every
    // notifyChatOversight caller today is one of these three, so this is no
    // longer a partial gate in practice, just documented intent. Each
    // recipient gets it pushed to their personal room (chat.socket.ts joins
    // every authenticated connection to `user:<id>` on connect) — a
    // recipient with no open tab simply never receives it; the bell still
    // catches up on next poll regardless.
    if (params.type === "chat_needs_agent" || params.type === "sla_at_risk" || params.type === "sla_breached") {
      const io = getIoInstance();
      if (io) {
        for (const recipient of recipients) {
          io.to(`user:${recipient._id.toString()}`).emit("notification:new", {
            type: params.type,
            conversationId: params.conversationId.toString(),
          });
        }
      }
    }
  } catch (err) {
    console.error("[notifications] failed to create chat oversight notifications", err);
  }
}
