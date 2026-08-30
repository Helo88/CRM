import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { Conversation } from "../../src/models/Conversation";
import { Message } from "../../src/models/Message";

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("conversation-routes-test"));
});

afterAll(async () => {
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

async function seedUser(overrides: Partial<{ role: string; email: string; name: string }> = {}) {
  const user = await User.create({
    name: overrides.name ?? "Test Customer",
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "customer",
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

describe("POST /api/v1/conversations (Story 14)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).post("/api/v1/conversations").send({});
    expect(res.status).toBe(401);
  });

  it("returns 403 for an agent", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app).post("/api/v1/conversations").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });

  it("returns 403 for an admin", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).post("/api/v1/conversations").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });

  it("creates a Conversation for a customer and returns 201", async () => {
    const { user, token } = await seedUser();
    const res = await request(app).post("/api/v1/conversations").set("Authorization", `Bearer ${token}`).send({});

    expect(res.status).toBe(201);
    expect(res.body.conversation.customer).toBe(user.id);
    expect(res.body.conversation.status).toBe("ai_handling");
    expect(res.body.conversation.assignedAgent).toBeNull();

    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("returns 404 for POST /:id/escalate — escalation is socket-only (Story 16)", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/v1/conversations/abc/escalate")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/conversations (Story 18)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/conversations");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a customer", async () => {
    const { token } = await seedUser();
    const res = await request(app).get("/api/v1/conversations").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("scopes an agent's list to their own assigned escalated/with_agent conversations", async () => {
    const { user: customer } = await seedUser();
    const { user: agent, token: agentToken } = await seedUser({ role: "agent" });
    const { user: otherAgent } = await seedUser({ role: "agent" });
    const mine = await Conversation.create({ customer: customer._id, assignedAgent: agent._id, status: "with_agent" });
    await Conversation.create({ customer: customer._id, assignedAgent: otherAgent._id, status: "with_agent" });
    await Conversation.create({ customer: customer._id, assignedAgent: agent._id, status: "resolved" });

    const res = await request(app).get("/api/v1/conversations").set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0]._id).toBe(mine.id);
  });

  it("returns every active conversation for an admin, regardless of assignment", async () => {
    const { user: customer } = await seedUser();
    const { user: agentA } = await seedUser({ role: "agent" });
    const { user: agentB } = await seedUser({ role: "agent" });
    const { token: adminToken } = await seedUser({ role: "admin" });
    await Conversation.create({ customer: customer._id, assignedAgent: agentA._id, status: "with_agent" });
    await Conversation.create({ customer: customer._id, assignedAgent: agentB._id, status: "escalated" });
    await Conversation.create({ customer: customer._id, assignedAgent: agentA._id, status: "resolved" });

    const res = await request(app).get("/api/v1/conversations").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(2);
  });
});

describe("GET /api/v1/conversations/:id (Story 18)", () => {
  it("returns 401 without a token", async () => {
    const conversation = await Conversation.create({ customer: new mongoose.Types.ObjectId() });
    const res = await request(app).get(`/api/v1/conversations/${conversation.id}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a malformed id and for an unknown id", async () => {
    const { token } = await seedUser({ role: "admin" });
    const resMalformed = await request(app)
      .get("/api/v1/conversations/not-an-object-id")
      .set("Authorization", `Bearer ${token}`);
    expect(resMalformed.status).toBe(404);

    const resUnknown = await request(app)
      .get(`/api/v1/conversations/${new mongoose.Types.ObjectId()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(resUnknown.status).toBe(404);
  });

  it("lets the assigned agent view the transcript including AI messages", async () => {
    const { user: customer } = await seedUser();
    const { user: agent, token: agentToken } = await seedUser({ role: "agent" });
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "with_agent",
    });
    await Message.create({ parentType: "conversation", parentId: conversation._id, senderType: "customer", senderId: customer._id, text: "hi" });
    await Message.create({ parentType: "conversation", parentId: conversation._id, senderType: "ai", senderId: null, text: "AI reply" });

    const res = await request(app)
      .get(`/api/v1/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.conversation._id).toBe(conversation.id);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages.map((m: { senderType: string }) => m.senderType)).toEqual(["customer", "ai"]);
  });

  it("lets the owning customer view their own conversation", async () => {
    const { user: customer, token: customerToken } = await seedUser();
    const conversation = await Conversation.create({ customer: customer._id, status: "ai_handling" });

    const res = await request(app)
      .get(`/api/v1/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
  });

  it("lets an admin view any conversation regardless of assignment", async () => {
    const { user: customer } = await seedUser();
    const { user: agent } = await seedUser({ role: "agent" });
    const { token: adminToken } = await seedUser({ role: "admin" });
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "with_agent",
    });

    const res = await request(app)
      .get(`/api/v1/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("rejects an unassigned agent with 403", async () => {
    const { user: customer } = await seedUser();
    const { user: assignedAgent } = await seedUser({ role: "agent" });
    const { token: otherAgentToken } = await seedUser({ role: "agent" });
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: assignedAgent._id,
      status: "with_agent",
    });

    const res = await request(app)
      .get(`/api/v1/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${otherAgentToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects a foreign customer with 403", async () => {
    const { user: owner } = await seedUser();
    const { token: otherCustomerToken } = await seedUser();
    const conversation = await Conversation.create({ customer: owner._id, status: "ai_handling" });

    const res = await request(app)
      .get(`/api/v1/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);
    expect(res.status).toBe(403);
  });
});
