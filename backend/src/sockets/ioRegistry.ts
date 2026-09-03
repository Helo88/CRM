import type { Server } from "socket.io";

// chat.socket.ts's `io` instance is created in server.ts and normally only
// flows into registerChatHandlers(io). notification.service.ts needs it too
// (to push a real-time toast alongside the existing DB-backed notification),
// but importing chat.socket.ts from notification.service.ts would be
// circular (chat.socket.ts already imports notification helpers). This tiny
// module breaks that cycle: server.ts calls setIoInstance(io) once at
// startup, anything else reads it back via getIoInstance().
let ioInstance: Server | null = null;

export function setIoInstance(io: Server): void {
  ioInstance = io;
}

// Null in the test environment (createApp() never calls setIoInstance) —
// every call site must treat a null return as "no live socket server,
// skip the real-time push" rather than assuming it's always set.
export function getIoInstance(): Server | null {
  return ioInstance;
}
