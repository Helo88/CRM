import express, { Request, Response } from "express";
import mongoose from "mongoose";

const router = express.Router();

// Simple end-to-end wiring check: confirms the API is up and reports DB connection
// state, so `npm run dev` + a curl/browser hit gives an immediate signal that the
// scaffold is wired correctly before any real story is implemented.
router.get("/health", (req: Request, res: Response) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    db: dbStates[mongoose.connection.readyState] || "unknown",
    timestamp: new Date().toISOString(),
  });
});

export default router;
