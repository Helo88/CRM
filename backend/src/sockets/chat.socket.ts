import { Server, Socket } from "socket.io";

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

export function registerChatHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // Client joins the room for a specific conversation so messages only broadcast
    // to participants of that conversation.
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // TODO (live-chat Stories 14-18): validate sender, persist the message via a
    // Message-service call, invoke the AI agent service on the customer's first
    // message, then broadcast to the room.
    socket.on("conversation:message", async (payload: ConversationMessagePayload) => {
      const { conversationId } = payload;
      io.to(`conversation:${conversationId}`).emit("conversation:message", payload);
    });

    socket.on("disconnect", () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });
}
