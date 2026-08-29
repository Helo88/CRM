import express, { NextFunction, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { Conversation } from "../models/Conversation";
import { validateBody } from "../middleware/validate";
import { createConversationSchema } from "../validation/conversation.schema";

const router = express.Router();

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

export default router;
