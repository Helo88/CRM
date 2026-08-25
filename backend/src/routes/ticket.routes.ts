import express, { Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";

const router = express.Router();

// TODO (ticket-management feature, Story 8): POST / — customer submits a ticket;
// create it with status "new", auto-assign (Story 10), send acknowledgment email
// (email.service.ts) with a reference number.
router.post("/", requireAuth, requireRole("customer"), (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md ticket-management Story 8" });
});

// TODO (ticket-management feature, Story 13 / customer-portal Story 35-36):
// GET / — list tickets (scoped to the caller: their own if customer, assigned if
// agent, all if admin).
router.get("/", requireAuth, (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md ticket-management Story 13" });
});

export default router;
