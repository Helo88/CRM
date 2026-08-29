import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../middleware/auth";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { objectIdSchema } from "../validation/common";
import { conversationMessagePayloadSchema } from "../validation/conversation.schema";
import { getAiReply } from "../services/liveChatAi.service";

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

// Whether `userId` may act on `conversation` — the conversation's own customer
// (this story) or its assignedAgent (inert until Story 17 assigns one, but
// forward-compatible so Story 18's agent-reply handler needs no change here).
function isAuthorizedOnConversation(userId: string, conversation: { customer: unknown; assignedAgent: unknown }): boolean {
  return userId === String(conversation.customer) || userId === String(conversation.assignedAgent);
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

      if (!isAuthorizedOnConversation(socket.data.user.id, conversation)) {
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

      if (!isAuthorizedOnConversation(socket.data.user.id, conversation)) {
        socket.emit("conversation:error", {
          error: "You do not have permission to send messages in this conversation",
        });
        return;
      }

      if (conversation.status === "resolved") {
        socket.emit("conversation:error", { error: "This conversation is closed" });
        return;
      }

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

    socket.on("disconnect", () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });
}
