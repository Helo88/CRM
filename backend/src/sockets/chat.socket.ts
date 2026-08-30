import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../middleware/auth";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { objectIdSchema } from "../validation/common";
import {
  conversationMessagePayloadSchema,
  conversationEscalatePayloadSchema,
  conversationClosePayloadSchema,
} from "../validation/conversation.schema";
import { getAiReply } from "../services/liveChatAi.service";
import { pickAndClaimAgentForConversation } from "../services/assignment.service";

const AI_FALLBACK_TEXT =
  "I'm having trouble answering right now — you can try again or ask to speak with a human agent.";

/**
 * Socket.io wiring for the live-chat feature (Stories 14, 18: real-time messaging).
 * This is intentionally a thin skeleton — connection/room handling only. The actual
 * message-handling logic (persisting to Message, invoking the AI agent on the
 * customer's first message, escalation, auto-assignment) belongs to each story's
 * implementation and should live in src/services/ + be called from here, not
 * written inline in these handlers.
 */

interface ConversationMessagePayload {
  conversationId: string;
  text: string;
  [key: string]: unknown;
}

const conversationIdSchema = objectIdSchema("Invalid conversation id");

// Whether `user` may act on `conversation` — the conversation's own customer,
// its assignedAgent, or (Story 18) any admin regardless of assignment, so an
// admin can take over/respond to any live chat per that story's acceptance
// criteria.
function isAuthorizedOnConversation(
  user: { id: string; role: string },
  conversation: { customer: unknown; assignedAgent: unknown }
): boolean {
  if (user.role === "admin") return true;
  return user.id === String(conversation.customer) || user.id === String(conversation.assignedAgent);
}

export function registerChatHandlers(io: Server): void {
  // Story 14: Socket.io connections carry a JWT in the handshake `auth`
  // payload, verified once at connect-time — reuses the same JWT_SECRET/
  // JwtPayload shape requireAuth already uses (middleware/auth.ts), so
  // there's one auth model across REST and sockets. An alternative
  // (re-authenticating every conversation:message against the DB) was
  // rejected: later stories (16 escalate, 18 agent reply) need the caller's
  // role available at message time, which this way is already on
  // socket.data.user with no per-event DB lookup.
  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.headers.authorization?.startsWith("Bearer ")
        ? socket.handshake.headers.authorization.slice(7)
        : undefined);

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      socket.data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // Client joins the room for a specific conversation so messages only broadcast
    // to participants of that conversation.
    socket.on("conversation:join", async (conversationId: string) => {
      const parsedId = conversationIdSchema.safeParse(conversationId);
      if (!parsedId.success) {
        socket.emit("conversation:error", { error: "Invalid conversation id" });
        return;
      }

      const conversation = await Conversation.findById(parsedId.data);
      if (!conversation) {
        socket.emit("conversation:error", { error: "Conversation not found" });
        return;
      }

      if (!isAuthorizedOnConversation(socket.data.user, conversation)) {
        socket.emit("conversation:error", { error: "You do not have permission to join this conversation" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      socket.emit("conversation:joined", { conversationId });
    });

    // Story 14: validates sender, persists the message, and broadcasts it.
    // Story 15: right after the customer's own message is persisted and
    // broadcast, triggers the AI agent's reply — see the guard below.
    socket.on("conversation:message", async (payload: ConversationMessagePayload) => {
      const parsed = conversationMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("conversation:error", { error: parsed.error.issues[0]?.message ?? "Invalid message" });
        return;
      }
      const { conversationId, text } = parsed.data;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit("conversation:error", { error: "Conversation not found" });
        return;
      }

      if (!isAuthorizedOnConversation(socket.data.user, conversation)) {
        socket.emit("conversation:error", {
          error: "You do not have permission to send messages in this conversation",
        });
        return;
      }

      if (conversation.status === "resolved") {
        socket.emit("conversation:error", { error: "This conversation is closed" });
        return;
      }

      // Story 18: an admin replying (never the conversation's own customer,
      // rarely its assignedAgent) also serializes as "agent" — Message has no
      // separate "admin" sender type, and a UI-side distinction isn't part of
      // this story (Story 24 covers internal team roles/notes).
      const senderType = socket.data.user.id === String(conversation.customer) ? "customer" : "agent";

      const message = await Message.create({
        parentType: "conversation",
        parentId: conversation._id,
        senderType,
        senderId: socket.data.user.id,
        text,
      });

      io.to(`conversation:${conversationId}`).emit("conversation:message", message);

      // Story 15: the AI agent answers every customer message while the
      // conversation hasn't been escalated. Keying off `status` (rather than
      // "no prior AI/agent message") means Story 16's escalation flips this
      // off with no change here.
      if (senderType === "customer" && conversation.status === "ai_handling") {
        const roomKey = `conversation:${conversationId}`;
        io.to(roomKey).emit("conversation:ai-typing", { conversationId });

        try {
          const reply = await getAiReply(conversationId);
          const aiMessage = await Message.create({
            parentType: "conversation",
            parentId: conversation._id,
            senderType: "ai",
            senderId: null,
            text: reply ?? AI_FALLBACK_TEXT,
          });
          io.to(roomKey).emit("conversation:message", aiMessage);
        } catch (err) {
          console.error("[chat.socket] AI branch failed:", (err as Error).message);
          try {
            const fallback = await Message.create({
              parentType: "conversation",
              parentId: conversation._id,
              senderType: "ai",
              senderId: null,
              text: AI_FALLBACK_TEXT,
            });
            io.to(roomKey).emit("conversation:message", fallback);
          } catch (innerErr) {
            console.error("[chat.socket] fallback persistence also failed:", (innerErr as Error).message);
          }
        }
      }
    });

    // Story 16: customer-triggered "talk to a human" — flips status to
    // "escalated", which is enough on its own to disable the Story 15 AI
    // branch above (it only fires while status === "ai_handling"). Story 17
    // (auto-assign an escalated chat) is the one that queries
    // Conversation.find({ status: "escalated", assignedAgent: null }) and
    // actually picks an agent — nothing here does that.
    socket.on("conversation:escalate", async (payload: { conversationId: string }) => {
      const parsed = conversationEscalatePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("conversation:error", { error: parsed.error.issues[0]?.message ?? "Invalid escalate payload" });
        return;
      }
      const { conversationId } = parsed.data;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit("conversation:error", { error: "Conversation not found" });
        return;
      }

      // Customer-only: agents never escalate on the customer's behalf in
      // this story (stricter than isAuthorizedOnConversation, which also
      // allows the assignedAgent).
      if (socket.data.user.id !== String(conversation.customer)) {
        socket.emit("conversation:error", { error: "You do not have permission to escalate this conversation" });
        return;
      }

      if (conversation.status === "resolved") {
        socket.emit("conversation:error", { error: "This conversation is closed" });
        return;
      }

      // Idempotent: already-escalated / already-with-agent is a no-op
      // success — re-emit directly to the caller so a reconnecting client
      // can re-sync its UI state without erroring.
      if (conversation.status === "escalated" || conversation.status === "with_agent") {
        socket.emit("conversation:escalated", { conversationId, status: conversation.status });
        return;
      }

      conversation.status = "escalated";
      await conversation.save();

      io.to(`conversation:${conversationId}`).emit("conversation:escalated", {
        conversationId,
        status: "escalated",
      });

      // Story 17: immediately try to pick + claim an online agent. Never
      // lets a failure here undo the escalation the customer already saw
      // succeed above — only logged, never rethrown.
      try {
        const pickedAgentId = await pickAndClaimAgentForConversation(conversationId);
        if (pickedAgentId) {
          io.to(`conversation:${conversationId}`).emit("conversation:assigned", {
            conversationId,
            agentId: pickedAgentId.toString(),
            status: "with_agent",
          });
        } else {
          // No online agent: revert to ai_handling (guarded so a conversation
          // already moved on — e.g. closed concurrently — is left alone) and
          // tell only the escalating customer, so the Story 15 AI branch
          // resumes on their next message.
          await Conversation.findOneAndUpdate(
            { _id: conversationId, status: "escalated" },
            { $set: { status: "ai_handling" } }
          );
          socket.emit("conversation:no-agent-available", { conversationId });
        }
      } catch (err) {
        console.error("[chat.socket] auto-assign on escalate failed:", (err as Error).message);
      }
    });

    // Story 17: minimal customer-triggered close, offered from the "no
    // agent available" hint. Story 19 ("Close a live chat conversation")
    // replaces this with the full agent-facing close flow — this handler
    // only needs to be functional, not polished.
    socket.on("conversation:close", async (payload: { conversationId: string }) => {
      const parsed = conversationClosePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("conversation:error", { error: parsed.error.issues[0]?.message ?? "Invalid close payload" });
        return;
      }
      const { conversationId } = parsed.data;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit("conversation:error", { error: "Conversation not found" });
        return;
      }

      if (socket.data.user.id !== String(conversation.customer)) {
        socket.emit("conversation:error", { error: "You do not have permission to close this conversation" });
        return;
      }

      if (conversation.status === "resolved") {
        socket.emit("conversation:closed", { conversationId, status: "resolved" });
        return;
      }

      // assignedAgent is intentionally left untouched — history keeps it.
      conversation.status = "resolved";
      await conversation.save();

      io.to(`conversation:${conversationId}`).emit("conversation:closed", {
        conversationId,
        status: "resolved",
      });
    });

    socket.on("disconnect", () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });
}
