import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import ticketRoutes from "./routes/ticket.routes";
import conversationRoutes from "./routes/conversation.routes";
import customerRoutes from "./routes/customer.routes";
import meRoutes from "./routes/me.routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp(): Application {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/api/v1", healthRoutes);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/tickets", ticketRoutes);
  app.use("/api/v1/conversations", conversationRoutes);
  app.use("/api/v1/customers", customerRoutes);
  app.use("/api/v1/me", meRoutes);
  // TODO: mount remaining feature routers as they're implemented —
  // agent-workspace, sla-automation, knowledge-base, ai-features, security-admin,
  // reports-management (see USER_STORIES.md for the full feature list).

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
