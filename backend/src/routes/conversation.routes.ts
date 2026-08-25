import express, { Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";

const router = express.Router();

// TODO (live-chat feature, Story 14): POST / — customer starts a new conversation.
router.post("/", requireAuth, requireRole("customer"), (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md live-chat Story 14" });
});

// TODO (live-chat feature, Story 16): POST /:id/escalate — flag for human hand-off
// and queue for auto-assignment (Story 17).
router.post("/:id/escalate", requireAuth, requireRole("customer"), (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md live-chat Story 16" });
});

export default router;
