import express, { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { validateBody } from "../middleware/validate";
import { createConversationSchema } from "../validation/conversation.schema";

const router = express.Router();

// Shared with chat.socket.ts's isAuthorizedOnConversation (Story 18): the
// conversation's own customer, its assignedAgent, or any admin. Kept as a
// separate small helper here rather than importing the socket module's
// version, so this route file never depends on Socket.io wiring.
function callerAuthorizedOnConversation(
  user: { id: string; role: string },
  conversation: { customer: unknown; assignedAgent: unknown }
): boolean {
  if (user.role === "admin") return true;
  return user.id === String(conversation.customer) || user.id === String(conversation.assignedAgent);
}

// live-chat Story 14: customer starts a new conversation. Real-time messaging
// itself is handled over Socket.io (see sockets/chat.socket.ts) — this route
// only creates the parent Conversation document the socket handlers attach to.
router.post(
  "/",
  requireAuth,
  requireRole("customer"),
  validateBody(createConversationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await Conversation.create({
        customer: req.user!.id,
        // status defaults to "ai_handling" per the model; explicit here for readability.
        status: "ai_handling",
        assignedAgent: null,
      });
      res.status(201).json({ conversation });
    } catch (err) {
      next(err);
    }
  }
);

// Story 16 ("Escalate to a human agent") is socket-only, not a REST route —
// see backend/src/sockets/chat.socket.ts's conversation:escalate handler.
// conversation:message is already the customer's only real-time channel into
// the conversation, so escalation reuses that same authenticated/authorized
// transport rather than introducing a second parallel one.

// Story 18: staff-scoped list of active conversations — an agent's own
// assigned ones, or every active one for an admin. Not paginated yet
// (platform Story 59 covers that consistently once it's this route's turn).
// Story 19 (close a live chat) intentionally does NOT widen this filter to
// include "resolved" — a closed conversation drops out of this list on
// purpose; the agent who closed it still has the URL, and GET /:id stays
// readable regardless of status. A polished "closed chats" history view is
// separate, later scope, not a gap to silently "fix" here.
router.get("/", requireAuth, requireRole("agent", "admin"), async (req: Request, res: Response) => {
  const filter =
    req.user!.role === "admin"
      ? { status: { $in: ["escalated", "with_agent"] } }
      : { assignedAgent: new Types.ObjectId(req.user!.id), status: { $in: ["escalated", "with_agent"] } };
  const conversations = await Conversation.find(filter).sort({ updatedAt: -1 }).lean();
  res.status(200).json({ conversations });
});

// Story 18: the agent-facing transcript read — full history including prior
// AI messages, so the agent has context before replying. Also reachable by
// the conversation's own customer (same authorization rule as the socket
// handlers) so this one endpoint can later back a customer-side view too,
// though only the staff path is built out this story.
router.get(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "customer"),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    // 403, not 404 — unlike a customer probing a foreign ticket id, a
    // wrong-conversation agent/admin case is a real permission question the
    // caller is allowed to know about (no customer-identity leak risk here).
    if (!callerAuthorizedOnConversation({ id: req.user!.id, role: req.user!.role }, conversation)) {
      res.status(403).json({ error: "You do not have permission to view this conversation" });
      return;
    }
    const messages = await Message.find({ parentType: "conversation", parentId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    res.status(200).json({ conversation, messages });
  }
);

export default router;
