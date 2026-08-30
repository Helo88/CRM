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
import * as liveChatAiService from "../../src/services/liveChatAi.service";

vi.mock("../../src/services/liveChatAi.service", () => ({
  getAiReply: vi.fn(),
}));

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
  vi.mocked(liveChatAiService.getAiReply).mockReset();
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

async function seedOnlineAgent() {
  return User.create({
    name: "Available Agent",
    email: `agent-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: "agent",
    isOnline: true,
    isActive: true,
  });
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
    // Story 15: this conversation defaults to status "ai_handling", so the
    // customer's message also triggers an AI reply — scope this assertion to
    // the customer's own message to keep testing only what Story 14 added.
    expect(await Message.countDocuments({ parentType: "conversation", senderType: "customer" })).toBe(1);

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

describe("chat.socket.ts AI agent branch (Story 15)", () => {
  async function joinedSocket(conversationId: string, token: string): Promise<ClientSocket> {
    const socket = await connect(token);
    await new Promise((resolve) => {
      socket.on("conversation:joined", resolve);
      socket.emit("conversation:join", conversationId);
    });
    return socket;
  }

  it("emits ai-typing then a labeled AI reply when the conversation is ai_handling", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });
    vi.mocked(liveChatAiService.getAiReply).mockResolvedValue("Here's the answer.");
    const socket = await joinedSocket(conversation.id, token);

    const typing = new Promise((resolve) => socket.on("conversation:ai-typing", resolve));
    const messages: Record<string, unknown>[] = [];
    const secondMessage = new Promise<Record<string, unknown>>((resolve) => {
      socket.on("conversation:message", (msg: Record<string, unknown>) => {
        messages.push(msg);
        if (messages.length === 2) resolve(msg);
      });
    });
    socket.emit("conversation:message", { conversationId: conversation.id, text: "hi" });

    await expect(typing).resolves.toEqual({ conversationId: conversation.id });
    const aiMessage = await secondMessage;
    expect(aiMessage.senderType).toBe("ai");
    expect(aiMessage.text).toBe("Here's the answer.");
    expect(await Message.countDocuments({ senderType: "ai" })).toBe(1);

    socket.disconnect();
  });

  it("broadcasts the fallback text (still senderType ai) when getAiReply resolves null", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });
    vi.mocked(liveChatAiService.getAiReply).mockResolvedValue(null);
    const socket = await joinedSocket(conversation.id, token);

    const messages: Record<string, unknown>[] = [];
    const secondMessage = new Promise<Record<string, unknown>>((resolve) => {
      socket.on("conversation:message", (msg: Record<string, unknown>) => {
        messages.push(msg);
        if (messages.length === 2) resolve(msg);
      });
    });
    socket.emit("conversation:message", { conversationId: conversation.id, text: "hi" });

    const aiMessage = await secondMessage;
    expect(aiMessage.senderType).toBe("ai");
    expect(aiMessage.text).toMatch(/trouble answering/i);

    socket.disconnect();
  });

  it("persists+broadcasts the fallback when Message.create throws for the AI reply", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });
    vi.mocked(liveChatAiService.getAiReply).mockResolvedValue("Would have been the reply");
    // Only the AI-reply Message.create (the 2nd call: 1st is the customer's
    // own message) should throw — the customer's message must still persist.
    const originalCreate = Message.create.bind(Message);
    let createCalls = 0;
    const createSpy = vi.spyOn(Message, "create").mockImplementation(((...args: unknown[]) => {
      createCalls += 1;
      if (createCalls === 2) {
        throw new Error("db hiccup");
      }
      return originalCreate(...(args as Parameters<typeof originalCreate>));
    }) as typeof Message.create);
    const socket = await joinedSocket(conversation.id, token);

    const messages: Record<string, unknown>[] = [];
    const secondMessage = new Promise<Record<string, unknown>>((resolve) => {
      socket.on("conversation:message", (msg: Record<string, unknown>) => {
        messages.push(msg);
        if (messages.length === 2) resolve(msg);
      });
    });
    socket.emit("conversation:message", { conversationId: conversation.id, text: "hi" });

    const aiMessage = await secondMessage;
    expect(aiMessage.senderType).toBe("ai");
    expect(aiMessage.text).toMatch(/trouble answering/i);

    createSpy.mockRestore();
    socket.disconnect();
  });

  it("does not trigger the AI branch for a non-customer sender", async () => {
    const { user: customer } = await seedUser("customer");
    const { user: agent, token: agentToken } = await seedUser("agent");
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "ai_handling",
    });
    const socket = await joinedSocket(conversation.id, agentToken);

    socket.emit("conversation:message", { conversationId: conversation.id, text: "agent reply" });
    await new Promise((resolve) => socket.on("conversation:message", resolve));

    expect(liveChatAiService.getAiReply).not.toHaveBeenCalled();
    expect(await Message.countDocuments({ senderType: "ai" })).toBe(0);

    socket.disconnect();
  });

  it.each(["escalated", "with_agent"])(
    "does not trigger the AI branch when status is %s",
    async (status) => {
      const { user, token } = await seedUser();
      const conversation = await Conversation.create({ customer: user._id, status });
      const socket = await joinedSocket(conversation.id, token);

      socket.emit("conversation:message", { conversationId: conversation.id, text: "hi" });
      await new Promise((resolve) => socket.on("conversation:message", resolve));

      expect(liveChatAiService.getAiReply).not.toHaveBeenCalled();
      expect(await Message.countDocuments({ senderType: "ai" })).toBe(0);

      socket.disconnect();
    }
  );
});

describe("chat.socket.ts escalate (Story 16)", () => {
  async function joinedSocket(conversationId: string, token: string): Promise<ClientSocket> {
    const socket = await connect(token);
    await new Promise((resolve) => {
      socket.on("conversation:joined", resolve);
      socket.emit("conversation:join", conversationId);
    });
    return socket;
  }

  it("flips status to escalated and broadcasts conversation:escalated", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });
    const socket = await joinedSocket(conversation.id, token);

    const escalated = new Promise((resolve) => socket.on("conversation:escalated", resolve));
    socket.emit("conversation:escalate", { conversationId: conversation.id });

    await expect(escalated).resolves.toEqual({ conversationId: conversation.id, status: "escalated" });
    expect((await Conversation.findById(conversation.id))!.status).toBe("escalated");

    socket.disconnect();
  });

  it("rejects a non-customer (agent) trying to escalate, leaving status unchanged", async () => {
    const { user: customer } = await seedUser("customer");
    const { user: agent, token: agentToken } = await seedUser("agent");
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "ai_handling",
    });
    const socket = await joinedSocket(conversation.id, agentToken);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:escalate", { conversationId: conversation.id });

    await expect(errored).resolves.toEqual({
      error: "You do not have permission to escalate this conversation",
    });
    expect((await Conversation.findById(conversation.id))!.status).toBe("ai_handling");

    socket.disconnect();
  });

  it("rejects a malformed payload", async () => {
    const { token } = await seedUser();
    const socket = await connect(token);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:escalate", { conversationId: "not-an-object-id" });

    await errored;
    socket.disconnect();
  });

  it("rejects escalating a resolved conversation", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "resolved" });
    const socket = await connect(token);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:escalate", { conversationId: conversation.id });

    await expect(errored).resolves.toEqual({ error: "This conversation is closed" });

    socket.disconnect();
  });

  it("is idempotent for an already-escalated conversation — no error, direct re-emit", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "escalated" });
    const socket = await connect(token);

    const escalated = new Promise((resolve) => socket.on("conversation:escalated", resolve));
    socket.emit("conversation:escalate", { conversationId: conversation.id });

    await expect(escalated).resolves.toEqual({ conversationId: conversation.id, status: "escalated" });

    socket.disconnect();
  });

  it("is idempotent for an already-with_agent conversation", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "with_agent" });
    const socket = await connect(token);

    const escalated = new Promise((resolve) => socket.on("conversation:escalated", resolve));
    socket.emit("conversation:escalate", { conversationId: conversation.id });

    await expect(escalated).resolves.toEqual({ conversationId: conversation.id, status: "with_agent" });

    socket.disconnect();
  });

  it("after escalation, with an agent online to claim it, a customer message persists but does not trigger the AI branch", async () => {
    // Story 17: an online agent claims the conversation right after
    // escalation, which is what keeps the AI branch off afterward — without
    // one, Story 17 reverts status to ai_handling on purpose (see that
    // story's own describe block below).
    await seedOnlineAgent();
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });
    const socket = await joinedSocket(conversation.id, token);

    await new Promise((resolve) => {
      socket.on("conversation:assigned", resolve);
      socket.emit("conversation:escalate", { conversationId: conversation.id });
    });

    socket.emit("conversation:message", { conversationId: conversation.id, text: "still here?" });
    await new Promise((resolve) => socket.on("conversation:message", resolve));

    expect(liveChatAiService.getAiReply).not.toHaveBeenCalled();
    expect(await Message.countDocuments({ senderType: "ai" })).toBe(0);
    expect(await Message.countDocuments({ senderType: "customer" })).toBe(1);

    socket.disconnect();
  });
});

describe("chat.socket.ts auto-assign on escalate (Story 17)", () => {
  async function joinedSocket(conversationId: string, token: string): Promise<ClientSocket> {
    const socket = await connect(token);
    await new Promise((resolve) => {
      socket.on("conversation:joined", resolve);
      socket.emit("conversation:join", conversationId);
    });
    return socket;
  }

  it("auto-assigns to the online agent and emits conversation:assigned to the room", async () => {
    const agent = await seedOnlineAgent();
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });
    const socket = await joinedSocket(conversation.id, token);

    const assigned = new Promise<Record<string, unknown>>((resolve) =>
      socket.on("conversation:assigned", resolve)
    );
    socket.emit("conversation:escalate", { conversationId: conversation.id });

    const payload = await assigned;
    expect(payload).toEqual({ conversationId: conversation.id, agentId: agent.id, status: "with_agent" });

    const reloaded = await Conversation.findById(conversation.id);
    expect(reloaded!.status).toBe("with_agent");
    expect(reloaded!.assignedAgent?.toString()).toBe(agent.id);

    socket.disconnect();
  });

  it("emits conversation:no-agent-available to the caller only and reverts status to ai_handling when no agent is online", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });
    const socket = await joinedSocket(conversation.id, token);

    const noAgent = new Promise<Record<string, unknown>>((resolve) =>
      socket.on("conversation:no-agent-available", resolve)
    );
    socket.emit("conversation:escalate", { conversationId: conversation.id });

    const payload = await noAgent;
    expect(payload).toEqual({ conversationId: conversation.id });

    const reloaded = await Conversation.findById(conversation.id);
    expect(reloaded!.status).toBe("ai_handling");
    expect(reloaded!.assignedAgent).toBeNull();

    socket.disconnect();
  });

  it("customer close via conversation:close flips status to resolved and broadcasts conversation:closed", async () => {
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "escalated" });
    const socket = await joinedSocket(conversation.id, token);

    const closed = new Promise((resolve) => socket.on("conversation:closed", resolve));
    socket.emit("conversation:close", { conversationId: conversation.id });

    await expect(closed).resolves.toEqual({ conversationId: conversation.id, status: "resolved" });
    expect((await Conversation.findById(conversation.id))!.status).toBe("resolved");

    socket.disconnect();
  });

  it("rejects a non-customer conversation:close with conversation:error", async () => {
    const { user: customer } = await seedUser("customer");
    const { user: agent, token: agentToken } = await seedUser("agent");
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "with_agent",
    });
    const socket = await joinedSocket(conversation.id, agentToken);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:close", { conversationId: conversation.id });

    await expect(errored).resolves.toEqual({
      error: "You do not have permission to close this conversation",
    });
    expect((await Conversation.findById(conversation.id))!.status).toBe("with_agent");

    socket.disconnect();
  });
});

describe("chat.socket.ts agent/admin reply (Story 18)", () => {
  async function joinedSocket(conversationId: string, token: string): Promise<ClientSocket> {
    const socket = await connect(token);
    await new Promise((resolve) => {
      socket.on("conversation:joined", resolve);
      socket.emit("conversation:join", conversationId);
    });
    return socket;
  }

  it("lets the assigned agent join and reply; message persists as senderType agent and broadcasts to the customer", async () => {
    const { user: customer, token: customerToken } = await seedUser("customer");
    const { user: agent, token: agentToken } = await seedUser("agent");
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "with_agent",
    });
    const customerSocket = await joinedSocket(conversation.id, customerToken);
    const agentSocket = await joinedSocket(conversation.id, agentToken);

    const receivedByCustomer = new Promise<Record<string, unknown>>((resolve) =>
      customerSocket.on("conversation:message", resolve)
    );
    agentSocket.emit("conversation:message", { conversationId: conversation.id, text: "How can I help?" });

    const message = await receivedByCustomer;
    expect(message.senderType).toBe("agent");
    expect(message.senderId).toBe(agent.id);
    expect(message.text).toBe("How can I help?");

    customerSocket.disconnect();
    agentSocket.disconnect();
  });

  it("does not trigger the AI branch for the agent's own reply", async () => {
    const { user: customer } = await seedUser("customer");
    const { user: agent, token: agentToken } = await seedUser("agent");
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "with_agent",
    });
    const socket = await joinedSocket(conversation.id, agentToken);

    socket.emit("conversation:message", { conversationId: conversation.id, text: "agent reply" });
    await new Promise((resolve) => socket.on("conversation:message", resolve));

    expect(liveChatAiService.getAiReply).not.toHaveBeenCalled();
    expect(await Message.countDocuments({ senderType: "ai" })).toBe(0);

    socket.disconnect();
  });

  it("admin can join and message any conversation even when not the assignedAgent", async () => {
    const { user: customer } = await seedUser("customer");
    const { user: agent } = await seedUser("agent");
    const { token: adminToken } = await seedUser("admin");
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "with_agent",
    });
    const socket = await joinedSocket(conversation.id, adminToken);

    const received = new Promise<Record<string, unknown>>((resolve) =>
      socket.on("conversation:message", resolve)
    );
    socket.emit("conversation:message", { conversationId: conversation.id, text: "Admin stepping in" });

    const message = await received;
    expect(message.senderType).toBe("agent"); // Message has no separate "admin" sender type
    expect(message.text).toBe("Admin stepping in");

    socket.disconnect();
  });

  it("an unassigned, non-admin agent is still rejected (regression on the widened check)", async () => {
    const { user: customer } = await seedUser("customer");
    const { user: assignedAgent } = await seedUser("agent");
    const { token: otherAgentToken } = await seedUser("agent");
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: assignedAgent._id,
      status: "with_agent",
    });
    const socket = await connect(otherAgentToken);

    const errored = new Promise((resolve) => socket.on("conversation:error", resolve));
    socket.emit("conversation:join", conversation.id);

    await expect(errored).resolves.toEqual({ error: "You do not have permission to join this conversation" });

    socket.disconnect();
  });
});
