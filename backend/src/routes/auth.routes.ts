import express, { Request, Response } from "express";

const router = express.Router();

// TODO (auth feature, Story 1): POST /register — create a customer account
// (hash password with bcrypt, reject duplicate emails, issue a JWT on success).
router.post("/register", (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md auth Story 1" });
});

// TODO (auth feature, Story 2): POST /login — verify credentials for any role
// (customer/agent/admin) and return a JWT encoding { sub, role }.
router.post("/login", (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md auth Story 2" });
});

export default router;
