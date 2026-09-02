import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../../src/models/User";
import { Conversation } from "../../src/models/Conversation";
import { Message } from "../../src/models/Message";
import { Notification } from "../../src/models/Notification";
import { escalateConversation } from "../../src/services/conversationEscalation.service";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("conversation-escalation-service-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Notification.deleteMany({});
});

async function seedUser(overrides: Partial<{ role: string; permissions: string[] }> = {}) {
  return User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "customer",
    permissions: overrides.permissions ?? [],
    isActive: true,
  });
}

describe("escalateConversation (sla-automation Story 28)", () => {
  it("flips status to escalated, creates a system ack message, and notifies oversight", async () => {
    const customer = await seedUser();
    const admin = await seedUser({ role: "admin" });
    const conversation = await Conversation.create({ customer: customer._id, status: "ai_handling" });

    const result = await escalateConversation({ conversation, reason: "manual" });

    expect(result.conversation.status).toBe("escalated");
    expect((await Conversation.findById(conversation.id))!.status).toBe("escalated");

    expect(result.ackMessage).not.toBeNull();
    expect(result.ackMessage!.senderType).toBe("system");
    const messages = await Message.find({ parentType: "conversation", parentId: conversation._id });
    expect(messages).toHaveLength(1);

    const notifications = await Notification.find({ recipient: admin._id, type: "chat_needs_agent" });
    expect(notifications).toHaveLength(1);
  });

  it("is idempotent for an already-escalated conversation — no re-save, no duplicate message/notification", async () => {
    const customer = await seedUser();
    await seedUser({ role: "admin" });
    const conversation = await Conversation.create({ customer: customer._id, status: "escalated" });

    const result = await escalateConversation({ conversation, reason: "sla_breach" });

    expect(result.ackMessage).toBeNull();
    expect(await Message.countDocuments({})).toBe(0);
    expect(await Notification.countDocuments({})).toBe(0);
  });

  it("is idempotent for an already-with_agent conversation", async () => {
    const customer = await seedUser();
    const agent = await seedUser({ role: "agent" });
    const conversation = await Conversation.create({
      customer: customer._id,
      assignedAgent: agent._id,
      status: "with_agent",
    });

    const result = await escalateConversation({ conversation, reason: "sla_breach" });

    expect(result.conversation.status).toBe("with_agent");
    expect(result.ackMessage).toBeNull();
    expect(await Message.countDocuments({})).toBe(0);
  });

  it("accepts reason 'sla_breach' without throwing (no self-escalation concept for conversations)", async () => {
    const customer = await seedUser();
    const conversation = await Conversation.create({ customer: customer._id, status: "ai_handling" });

    const result = await escalateConversation({ conversation, reason: "sla_breach" });

    expect(result.conversation.status).toBe("escalated");
  });
});
