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

// TODO (live-chat feature, Story 16): POST /:id/escalate — flag for human hand-off
// and queue for auto-assignment (Story 17).
router.post("/:id/escalate", requireAuth, requireRole("customer"), (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md live-chat Story 16" });
});

export default router;
