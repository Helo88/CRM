import "dotenv/config";

import http from "http";
import { Server } from "socket.io";

import { createApp } from "./app";
import { connectDB } from "./config/db";
import { registerChatHandlers } from "./sockets/chat.socket";

async function start(): Promise<void> {
  await connectDB();

  const app = createApp();
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" },
  });
  registerChatHandlers(io);

  const port = process.env.PORT || 4000;
  httpServer.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
