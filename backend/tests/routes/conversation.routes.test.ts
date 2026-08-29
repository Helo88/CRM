import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { Conversation } from "../../src/models/Conversation";

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

  it("still returns 501 for POST /:id/escalate (Story 16, untouched)", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/v1/conversations/abc/escalate")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(501);
  });
});
