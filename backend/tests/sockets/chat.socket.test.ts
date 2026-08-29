import http from "http";
import { AddressInfo } from "net";
import { Server } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { registerChatHandlers } from "../../src/sockets/chat.socket";
import { User } from "../../src/models/User";
import { Conversation } from "../../src/models/Conversation";
import { Message } from "../../src/models/Message";

let mongod: MongoMemoryServer;
let httpServer: http.Server;
let io: Server;
let port: number;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("chat-socket-test"));

  httpServer = http.createServer();
  io = new Server(httpServer);
  registerChatHandlers(io);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
});

function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string);
}

async function seedUser(role = "customer") {
  const user = await User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role,
  });
  return { user, token: tokenFor({ id: user.id, role }) };
}

function connect(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      auth: token ? { token } : {},
      transports: ["websocket"],
      reconnection: false,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });
}

describe("chat.socket.ts (Story 14)", () => {
  it("rejects a connection with no token", async () => {
    await expect(connect()).rejects.toThrow("Unauthorized");
  });

  it("rejects a connection with a bogus token", async () => {
    await expect(connect("not-a-real-token")).rejects.toThrow("Unauthorized");
  });

  it("lets the conversation's own customer join", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id });
    const socket = await connect(token);

    const joined = new Promise((resolve) => socket.on("conversation:joined", resolve));
    socket.emit("conversation:join", conversation.id);

    await expect(joined).resolves.toEqual({ conversationId: conversation.id });
    socket.disconnect();
  });

  it("rejects a foreign customer trying to join", async () => {
    const { user: owner } = await seedUser();
    const { token: otherToken } = await seedUser();
    const conversation = await Conversation.create({ customer: owner._id });
    const socket = await connect(otherToken);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:join", conversation.id);

    await expect(errored).resolves.toEqual({ error: "You do not have permission to join this conversation" });
    socket.disconnect();
  });

  it("persists and broadcasts a message after a valid join", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id });
    const socket = await connect(token);

    await new Promise((resolve) => {
      socket.on("conversation:joined", resolve);
      socket.emit("conversation:join", conversation.id);
    });

    const received = new Promise<Record<string, unknown>>((resolve) =>
      socket.on("conversation:message", resolve)
    );
    socket.emit("conversation:message", { conversationId: conversation.id, text: "hello" });

    const message = await received;
    expect(message.text).toBe("hello");
    expect(message.senderType).toBe("customer");
    expect(message.senderId).toBe(user.id);
    expect(message.parentType).toBe("conversation");
    expect(await Message.countDocuments({ parentType: "conversation" })).toBe(1);

    socket.disconnect();
  });

  it("rejects empty/whitespace-only text and writes no Message", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id });
    const socket = await connect(token);

    await new Promise((resolve) => {
      socket.on("conversation:joined", resolve);
      socket.emit("conversation:join", conversation.id);
    });

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:message", { conversationId: conversation.id, text: "   " });

    await errored;
    expect(await Message.countDocuments()).toBe(0);
    socket.disconnect();
  });

  it("rejects a message from a foreign sender and writes no Message", async () => {
    const { user: owner } = await seedUser();
    const { token: otherToken } = await seedUser();
    const conversation = await Conversation.create({ customer: owner._id });
    const socket = await connect(otherToken);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:message", { conversationId: conversation.id, text: "hello" });

    await expect(errored).resolves.toEqual({
      error: "You do not have permission to send messages in this conversation",
    });
    expect(await Message.countDocuments()).toBe(0);
    socket.disconnect();
  });

  it("rejects a message on a resolved conversation", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "resolved" });
    const socket = await connect(token);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:message", { conversationId: conversation.id, text: "hello" });

    await expect(errored).resolves.toEqual({ error: "This conversation is closed" });
    expect(await Message.countDocuments()).toBe(0);
    socket.disconnect();
  });
});
