import { IConversation } from "../models/Conversation";
import { Message, IMessage } from "../models/Message";
import { notifyChatOversight } from "./notification.service";

// live-chat Story 16's socket handler originally had this inline; extracted
// here (sla-automation Story 28) so the SLA monitor can trigger the same
// escalation on a breach without going through a socket.
export type ConversationEscalationReason = "manual" | "sla_breach";

export interface EscalateConversationInput {
  conversation: IConversation;
  reason: ConversationEscalationReason;
}

// The plan-level signature for this service is `Promise<IConversation>`, but
// the caller (chat.socket.ts) needs the persisted ack Message to re-broadcast
// it over the room in real time — recomputing/refetching it would be wasted
// work and could race a concurrent send. Returning it here (rather than
// having the service emit anything itself — it must not, per the "no socket
// events from inside the service" rule) is the smallest deviation that keeps
// the socket path's real-time behavior unchanged. `ackMessage` is null when
// this call was an idempotent no-op or when message creation failed
// (best-effort, matching the original inline behavior).
export interface EscalateConversationResult {
  conversation: IConversation;
  ackMessage: IMessage | null;
}

const ESCALATION_ACK_TEXT =
  "Thanks for waiting — I've flagged this conversation for our support team and someone will join shortly.";

// Idempotent: a conversation already "escalated" or "with_agent" is left
// untouched — no re-save, no duplicate ack message, no duplicate oversight
// notification. This matters for the SLA monitor path just as much as the
// socket path: a conversation an agent already claimed (with_agent) doesn't
// need re-escalating just because its response-target timer also breached.
// `reason` is accepted (not just for API symmetry with escalateTicket, whose
// SLA monitor caller passes the same shape to both) but currently has no
// branching effect — Conversation has no statusHistory-style audit trail for
// applyStatusTransition to write "manual" vs "auto_escalation" into, unlike
// Ticket. Kept in the signature so a future conversation history feature can
// start consuming it without an API change.
export async function escalateConversation({
  conversation,
  reason,
}: EscalateConversationInput): Promise<EscalateConversationResult> {
  void reason;
  if (conversation.status === "escalated" || conversation.status === "with_agent") {
    return { conversation, ackMessage: null };
  }

  conversation.status = "escalated";
  await conversation.save();

  // Never lets a failure here undo the status flip already saved above —
  // only logged, never rethrown. Same reasoning as the original inline
  // socket-handler code this was extracted from.
  let ackMessage: IMessage | null = null;
  try {
    ackMessage = await Message.create({
      parentType: "conversation",
      parentId: conversation._id,
      senderType: "system",
      senderId: null,
      text: ESCALATION_ACK_TEXT,
    });
    await notifyChatOversight({ type: "chat_needs_agent", conversationId: conversation._id });
  } catch (err) {
    console.error("[conversationEscalation] post-escalation ack/notify failed:", (err as Error).message);
  }

  return { conversation, ackMessage };
}
