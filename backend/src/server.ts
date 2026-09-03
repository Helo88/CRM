import "dotenv/config";

import http from "http";
import { Server } from "socket.io";

import { createApp } from "./app";
import { connectDB } from "./config/db";
import { registerChatHandlers } from "./sockets/chat.socket";
import { setIoInstance } from "./sockets/ioRegistry";
import { startSlaMonitor } from "./services/slaMonitor.service";

async function start(): Promise<void> {
  await connectDB();

  const app = createApp();
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" },
  });
  registerChatHandlers(io);
  setIoInstance(io);

  const port = process.env.PORT || 4000;
  httpServer.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });

  // sla-automation Story 28: SLA_MONITOR_ENABLED is an ops-level kill switch
  // (turn the whole feature off in an environment), deliberately kept as an
  // env var — unlike the threshold/interval (SlaSystemSettings, admin-tuned
  // at /admin/sla-targets), which are business settings, not ops config.
  if (process.env.SLA_MONITOR_ENABLED !== "false") {
    startSlaMonitor();
    console.log("[sla-monitor] started — threshold and interval are admin-configurable at /admin/sla-targets");
  }
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
