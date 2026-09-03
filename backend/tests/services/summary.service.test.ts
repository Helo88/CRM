import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../../src/models/User";
import { Ticket } from "../../src/models/Ticket";
import { Conversation } from "../../src/models/Conversation";
import { Message } from "../../src/models/Message";
import * as geminiService from "../../src/services/gemini.service";
import { summarizeTicket, summarizeConversation } from "../../src/services/summary.service";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("summary-service-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Ticket.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  vi.restoreAllMocks();
});

async function seedCustomer() {
  return User.create({
    name: "Customer",
    email: `customer-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: "customer",
  });
}

async function seedTicket() {
  const customer = await seedCustomer();
  return Ticket.create({
    subject: "Something is broken",
    description: "Details here",
    customer: customer._id,
  });
}

async function seedConversation() {
  const customer = await seedCustomer();
  return Conversation.create({ customer: customer._id, status: "with_agent" });
}

async function seedMessages(
  parentType: "ticket" | "conversation",
  parentId: mongoose.Types.ObjectId,
  count: number,
  extra: Partial<{ senderType: string; internal: boolean; text: (i: number) => string }> = {}
) {
  for (let i = 0; i < count; i++) {
    await Message.create({
      parentType,
      parentId,
      senderType: extra.senderType ?? (i % 2 === 0 ? "customer" : "agent"),
      senderId: null,
      text: extra.text ? extra.text(i) : `message ${i}`,
      internal: extra.internal ?? false,
    });
  }
}

describe("summarizeTicket (ai-features Story 32)", () => {
  it("returns not_enough_messages when the ticket has fewer than 2 messages", async () => {
    const ticket = await seedTicket();
    await seedMessages("ticket", ticket._id, 1);

    const outcome = await summarizeTicket(ticket.id);

    expect(outcome).toEqual({ ok: false, reason: "not_enough_messages" });
  });

  it("returns not_found when the ticket doesn't exist", async () => {
    const outcome = await summarizeTicket(new mongoose.Types.ObjectId().toHexString());

    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns ai_unavailable when generateText resolves to null", async () => {
    const ticket = await seedTicket();
    await seedMessages("ticket", ticket._id, 2);
    vi.spyOn(geminiService, "generateText").mockResolvedValue(null);

    const outcome = await summarizeTicket(ticket.id);

    expect(outcome).toEqual({ ok: false, reason: "ai_unavailable" });
  });

  it("returns ai_unavailable when generateText resolves to whitespace", async () => {
    const ticket = await seedTicket();
    await seedMessages("ticket", ticket._id, 2);
    vi.spyOn(geminiService, "generateText").mockResolvedValue("   ");

    const outcome = await summarizeTicket(ticket.id);

    expect(outcome).toEqual({ ok: false, reason: "ai_unavailable" });
  });

  it("returns the trimmed summary on success", async () => {
    const ticket = await seedTicket();
    await seedMessages("ticket", ticket._id, 2);
    vi.spyOn(geminiService, "generateText").mockResolvedValue("  Issue: ...\nWhat's been tried: ...\nCurrent status: ...  ");

    const outcome = await summarizeTicket(ticket.id);

    expect(outcome).toEqual({
      ok: true,
      summary: "Issue: ...\nWhat's been tried: ...\nCurrent status: ...",
    });
  });

  it("includes internal agent notes in the transcript, labelled", async () => {
    const ticket = await seedTicket();
    await seedMessages("ticket", ticket._id, 1, { senderType: "customer" });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: null,
      text: "Checked the billing system internally",
      internal: true,
    });
    const spy = vi.spyOn(geminiService, "generateText").mockResolvedValue("ok");

    await summarizeTicket(ticket.id);

    const prompt = spy.mock.calls[0][0];
    expect(prompt).toContain("Agent (internal note): Checked the billing system internally");
  });

  it("truncates the transcript to the last 50 messages and prefixes a truncation note", async () => {
    const ticket = await seedTicket();
    await seedMessages("ticket", ticket._id, 55, { text: (i) => `msg-${i}` });
    const spy = vi.spyOn(geminiService, "generateText").mockResolvedValue("ok");

    await summarizeTicket(ticket.id);

    const prompt = spy.mock.calls[0][0];
    expect(prompt).toContain("[transcript truncated to last 50 messages]");
    expect(prompt).not.toContain("msg-4\n");
    expect(prompt).toContain("msg-54");
  });

  it("only counts messages belonging to this ticket, not other tickets/conversations", async () => {
    const ticket = await seedTicket();
    const otherTicket = await seedTicket();
    await seedMessages("ticket", otherTicket._id, 5);
    await seedMessages("ticket", ticket._id, 1);

    const outcome = await summarizeTicket(ticket.id);

    expect(outcome).toEqual({ ok: false, reason: "not_enough_messages" });
  });
});

describe("summarizeConversation (ai-features Story 32)", () => {
  it("returns not_enough_messages when the conversation has fewer than 2 messages", async () => {
    const conversation = await seedConversation();
    await seedMessages("conversation", conversation._id, 1);

    const outcome = await summarizeConversation(conversation.id);

    expect(outcome).toEqual({ ok: false, reason: "not_enough_messages" });
  });

  it("returns not_found when the conversation doesn't exist", async () => {
    const outcome = await summarizeConversation(new mongoose.Types.ObjectId().toHexString());

    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns ai_unavailable when generateText resolves to null", async () => {
    const conversation = await seedConversation();
    await seedMessages("conversation", conversation._id, 2);
    vi.spyOn(geminiService, "generateText").mockResolvedValue(null);

    const outcome = await summarizeConversation(conversation.id);

    expect(outcome).toEqual({ ok: false, reason: "ai_unavailable" });
  });

  it("returns the trimmed summary on success", async () => {
    const conversation = await seedConversation();
    await seedMessages("conversation", conversation._id, 2);
    vi.spyOn(geminiService, "generateText").mockResolvedValue("A summary");

    const outcome = await summarizeConversation(conversation.id);

    expect(outcome).toEqual({ ok: true, summary: "A summary" });
  });

  it("only counts messages belonging to this conversation, not a ticket with the same id shape", async () => {
    const conversation = await seedConversation();
    const otherConversation = await seedConversation();
    await seedMessages("conversation", otherConversation._id, 5);
    await seedMessages("conversation", conversation._id, 1);

    const outcome = await summarizeConversation(conversation.id);

    expect(outcome).toEqual({ ok: false, reason: "not_enough_messages" });
  });
});
